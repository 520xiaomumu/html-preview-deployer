import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';
import QRCode from 'npm:qrcode@1.5.4';
import {
  getDeployContent,
  patchDeployContent,
  patchDeployVersion,
  postDeploy,
  type ServiceResult,
} from './deploy-service.ts';

const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0';
const FIRST_PARTY_ORIGIN = /^https:\/\/((www\.)?htmlcode\.fun|[\w.-]+\.vercel\.app)$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

let corsCache: { enabled: boolean; expiresAt: number } | null = null;

function readCorsEnabled(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as { enabled?: unknown }).enabled === true;
  }
  return false;
}

async function corsEnabled(supabase: SupabaseClient) {
  const now = Date.now();
  if (corsCache && corsCache.expiresAt > now) return corsCache.enabled;
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'cors_enabled')
    .maybeSingle();
  if (error) {
    console.error('Read CORS setting failed:', error);
    corsCache = { enabled: false, expiresAt: now + 60_000 };
    return false;
  }
  const enabled = readCorsEnabled(data?.value);
  corsCache = { enabled, expiresAt: now + 60_000 };
  return enabled;
}

function originAllowed(origin: string | null, corsOn: boolean) {
  if (!origin) return true;
  if (FIRST_PARTY_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin)) return true;
  return corsOn;
}

function corsHeaders(origin: string | null, allowed: boolean) {
  if (!allowed) return {} as Record<string, string>;
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function resolvePublicOrigin(value: string | null) {
  if (value && (FIRST_PARTY_ORIGIN.test(value) || LOCAL_ORIGIN.test(value))) return value;
  return 'https://www.htmlcode.fun';
}

function versionRoute(pathname: string) {
  const match = pathname.match(/^\/api\/deploys\/([^/]+)\/versions\/([^/]+)$/);
  if (!match) return null;
  return { code: decodeURIComponent(match[1]), version: decodeURIComponent(match[2]) };
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, error: message, errorCode: code }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': NO_STORE,
    },
  });
}

function toResponse(result: ServiceResult, extraHeaders: Record<string, string>) {
  const headers = new Headers(extraHeaders);
  for (const [key, value] of Object.entries(result.headers)) headers.set(key, value);
  if (!headers.has('content-type')) {
    headers.set(
      'content-type',
      typeof result.text === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    );
  }
  if (typeof result.text === 'string') {
    return new Response(result.text, { status: result.status, headers });
  }
  return new Response(JSON.stringify(result.json ?? {}), { status: result.status, headers });
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError(500, 'MISSING_ENV', 'Missing Supabase environment variables.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requestOrigin = request.headers.get('origin');
  const allowed = originAllowed(requestOrigin, await corsEnabled(supabase));
  const extraHeaders = corsHeaders(requestOrigin, allowed);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: allowed ? 204 : 403,
      headers: { ...extraHeaders, 'cache-control': NO_STORE },
    });
  }

  const url = new URL(request.url);
  const route = url.searchParams.get('x_route') || '';
  const publicOrigin = resolvePublicOrigin(url.searchParams.get('public_origin'));
  const contentType = request.headers.get('content-type') || '';

  try {
    let result: ServiceResult;
    if (request.method === 'GET' && route === '/api/deploy/content') {
      result = await getDeployContent({
        supabase,
        publicOrigin,
        code: url.searchParams.get('code'),
        url: url.searchParams.get('url'),
        version: url.searchParams.get('version'),
        download: url.searchParams.get('download') === '1',
      });
    } else if (request.method === 'POST' && route === '/api/deploy') {
      result = await postDeploy({
        supabase,
        contentType,
        rawBody: await request.text(),
        publicOrigin,
        createQrPng: async (target) => new Uint8Array(await QRCode.toBuffer(target)),
      });
    } else if (request.method === 'PATCH' && route === '/api/deploy/content') {
      result = await patchDeployContent({
        supabase,
        contentType,
        rawBody: await request.text(),
        publicOrigin,
      });
    } else if (request.method === 'PATCH') {
      const version = versionRoute(route);
      if (!version) return jsonError(404, 'NOT_FOUND', 'Unknown html-api route.');
      result = await patchDeployVersion({
        supabase,
        contentType,
        rawBody: await request.text(),
        publicOrigin,
        code: version.code,
        version: version.version,
      });
    } else {
      return jsonError(404, 'NOT_FOUND', 'Unknown html-api route.');
    }

    return toResponse(result, extraHeaders);
  } catch (error) {
    console.error('html-api error:', error);
    const response = jsonError(500, 'INTERNAL_ERROR', '请求处理失败。');
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
});
