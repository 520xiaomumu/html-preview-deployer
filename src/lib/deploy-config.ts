export const MAX_HTML_SIZE_BYTES = 1024 * 1024; // 1 MB
export const MAX_DESCRIPTION_LENGTH = 240;
export const SHORT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;

export const NO_STORE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0';
export const CDN_CACHE_CONTROL = 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600';
export const CDN_EDGE_CACHE_CONTROL = 's-maxage=1800, stale-while-revalidate=3600';
// `rev` is the storage object name. Replacing a version writes a new object, so this URL is immutable.
export const VERSION_HTML_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const VERSION_HTML_EDGE_CACHE_CONTROL = 's-maxage=31536000';
// Short on purpose: turning HTML_SERVE_VIA off should stop sending browsers to Supabase within an hour.
export const EDGE_REDIRECT_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600';
export const EDGE_REDIRECT_EDGE_CACHE_CONTROL = 's-maxage=3600';
// Public /s/:code. 60s is the longest a short link can name the previous primary
// version when tag deletion does not run. There is no stale-while-revalidate:
// the request after expiry waits for the current primary before responding.
export const SHORT_LINK_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
export const SHORT_LINK_EDGE_CACHE_CONTROL = 's-maxage=60';
// fbclid and other tracking params are not part of choosing the primary version.
export const CANONICAL_SHORT_LINK_EDGE_CACHE_CONTROL = 's-maxage=86400';
// Marketplace iframes use ?preview=1 and do not count views. The same short-link
// tag is deleted when the primary version changes. 15 minutes is the bound when
// that deletion does not run.
export const PREVIEW_REDIRECT_CACHE_CONTROL = 'public, max-age=0, s-maxage=900';
export const PREVIEW_REDIRECT_EDGE_CACHE_CONTROL = 's-maxage=900';
// Homepage list. The deploy-list tag is deleted on writes. View counts shown
// in the list can lag until the next recompute.
export const LIST_EDGE_CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=120';
export const DEPLOY_LIST_CACHE_TAG = 'deploy-list';

export function isValidHtmlContent(content: string) {
  return /(<!doctype html|<html[\s>])/i.test(content);
}

export function normalizeDescription(description: unknown) {
  const normalizedDescription = typeof description === 'string' ? description.trim() : '';
  return normalizedDescription ? normalizedDescription.slice(0, MAX_DESCRIPTION_LENGTH) : null;
}

export function resolveCodeFromInput(input: { code?: unknown; url?: unknown }): string | null {
  if (typeof input.code === 'string' && input.code.trim()) {
    return input.code.trim().toLowerCase();
  }

  if (typeof input.url === 'string' && input.url.trim()) {
    try {
      const parsed = new URL(input.url.trim());
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0] === 's') {
        return parts[1].toLowerCase();
      }
    } catch {
      return null;
    }
  }

  return null;
}
