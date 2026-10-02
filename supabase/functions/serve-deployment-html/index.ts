import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';

const BUCKET_NAME = 'deployments';
const SHORT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;
const PUBLIC_CACHE_CONTROL = 'public, max-age=2592000, immutable';
const NO_STORE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

let corsCache: { enabled: boolean; expiresAt: number } | null = null;

function getStoragePath(filePath: unknown, code: string) {
  const fallback = `html/${code}.html`;
  if (typeof filePath !== 'string' || !filePath.trim()) return fallback;

  try {
    const parsed = new URL(filePath);
    const marker = '/deployments/';
    const index = parsed.pathname.indexOf(marker);
    return index === -1 ? fallback : parsed.pathname.slice(index + marker.length) || fallback;
  } catch {
    return fallback;
  }
}

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

function withCors(headers: Record<string, string>, enabled: boolean) {
  if (!enabled) return headers;
  return { ...headers, ...CORS_HEADERS };
}

function textResponse(
  body: string,
  status: number,
  cacheControl: string,
  corsOn: boolean,
) {
  return new Response(body, {
    status,
    headers: withCors({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    }, corsOn),
  });
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing Supabase environment variables.', {
      status: 500,
      headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const corsOn = await corsEnabled(supabase);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: withCors({ 'Cache-Control': NO_STORE_CACHE_CONTROL }, corsOn),
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return textResponse('Method not allowed', 405, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('health') === '1') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: withCors({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      }, corsOn),
    });
  }

  const code = (url.searchParams.get('code') || '').trim().toLowerCase();
  const versionNumber = Number(url.searchParams.get('version'));
  const revision = url.searchParams.get('rev');
  const preview = url.searchParams.get('preview') === '1';

  if (!SHORT_CODE_PATTERN.test(code) || !Number.isInteger(versionNumber) || versionNumber <= 0) {
    return textResponse('Invalid deployment version', 400, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, status')
    .eq('code', code)
    .maybeSingle();

  if (deploymentError || !deployment) {
    return textResponse('Deployment not found or inactive', 404, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const { data: selectedVersion, error: versionError } = await supabase
    .from('deployment_versions')
    .select('id, file_path, status')
    .eq('deployment_id', deployment.id)
    .eq('version_number', versionNumber)
    .maybeSingle();

  if (versionError || !selectedVersion) {
    return textResponse('Deployment version not found', 404, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const publiclyVisible = deployment.status === 'active' && (selectedVersion.status || 'active') !== 'inactive';
  if (!publiclyVisible && !preview) {
    return textResponse('Deployment not found or inactive', 404, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const storagePath = getStoragePath(selectedVersion.file_path, code);
  const expectedRevision = storagePath.split('/').pop() || selectedVersion.id;
  if (revision !== expectedRevision) {
    return textResponse('Deployment version not found', 404, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error('Download error:', downloadError);
    return textResponse('File content not found', 404, NO_STORE_CACHE_CONTROL, corsOn);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const cacheable = publiclyVisible && !preview;
  return new Response(request.method === 'HEAD' ? null : bytes, {
    headers: withCors({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheable ? PUBLIC_CACHE_CONTROL : NO_STORE_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    }, corsOn),
  });
});
