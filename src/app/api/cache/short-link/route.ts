import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-response';
import { NO_STORE_CACHE_CONTROL, SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { purgePublishedPage } from '@/lib/purge-cache';
import { purgeTokensMatch } from '@/lib/short-link-cache';

export const dynamic = 'force-dynamic';

// html-api calls this after a publish or version write. The token is an HMAC
// of the short code under the service role key, which both sides already have.
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let body: { code?: unknown; token?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : '';
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!secret || !SHORT_CODE_PATTERN.test(code) || !purgeTokensMatch(secret, code, token)) {
    return jsonError({
      status: 401,
      code: 'SHORT_LINK_PURGE_UNAUTHORIZED',
      message: '短链缓存刷新未通过校验。',
    });
  }

  await purgePublishedPage(code);
  return NextResponse.json(
    { success: true, code },
    { headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL } },
  );
}
