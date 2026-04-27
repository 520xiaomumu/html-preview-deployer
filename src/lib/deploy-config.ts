export const MAX_HTML_SIZE_BYTES = 1024 * 1024; // 1 MB
export const MAX_DESCRIPTION_LENGTH = 240;
export const SHORT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;

export const NO_STORE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0';
export const CDN_CACHE_CONTROL = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600';
export const CDN_EDGE_CACHE_CONTROL = 's-maxage=120, stale-while-revalidate=600';

export function isValidHtmlContent(content: string) {
  return /(<!doctype html|<html[\s>])/i.test(content);
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
