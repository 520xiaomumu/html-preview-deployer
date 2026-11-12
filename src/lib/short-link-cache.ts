import { createHmac, timingSafeEqual } from 'node:crypto';

// Shared with supabase/functions/html-api/index.ts. Changing the prefix
// invalidates in-flight purge calls until both sides are deployed.
const PURGE_TOKEN_PREFIX = 'short-link:';

export function shortLinkCacheTag(code: string) {
  return `short-link-${code.trim().toLowerCase()}`;
}

export function canonicalShortLinkTarget(requestUrl: string, code: string) {
  const url = new URL(requestUrl);
  const preview = url.searchParams.get('preview');
  const extras = [...url.searchParams.keys()].filter((key) => key !== 'preview');
  const keepPreview = preview === '1';
  if (extras.length === 0 && (preview === null || keepPreview)) return null;

  const destination = new URL(`/s/${code}`, url.origin);
  if (keepPreview) destination.searchParams.set('preview', '1');
  return destination.toString();
}

export function shortLinkPurgeToken(secret: string, code: string) {
  return createHmac('sha256', secret)
    .update(`${PURGE_TOKEN_PREFIX}${code.trim().toLowerCase()}`)
    .digest('hex');
}

export function purgeTokensMatch(secret: string, code: string, token: string) {
  const expected = shortLinkPurgeToken(secret, code);
  const given = token.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
