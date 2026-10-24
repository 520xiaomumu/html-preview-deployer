const OFFLOAD_DISABLED = new Set(['vercel', 'next', 'proxy', 'off', '0', 'false', 'no']);

export function htmlApiOffloadEnabled(env: Record<string, string | undefined> = {
  HTML_API_VIA: process.env.HTML_API_VIA,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
}) {
  const mode = (env.HTML_API_VIA || '').trim().toLowerCase();
  if (OFFLOAD_DISABLED.has(mode)) return false;
  return Boolean((env.NEXT_PUBLIC_SUPABASE_URL || '').trim());
}

export function isOffloadedApiRequest(pathname: string, method: string, search = '') {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' && pathname === '/api/deploy/content') {
    // download=1 is a raw HTML response. The Supabase gateway rewrites text/html to text/plain,
    // so that one query stays on this app and keeps its content type.
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return params.get('download') !== '1';
  }
  if (normalizedMethod === 'POST' && pathname === '/api/deploy') return true;
  if (normalizedMethod === 'PATCH' && pathname === '/api/deploy/content') return true;
  return normalizedMethod === 'PATCH' && /^\/api\/deploys\/[^/]+\/versions\/[^/]+$/.test(pathname);
}

export function buildApiOffloadUrl(options: {
  supabaseUrl: string;
  pathname: string;
  search: string;
  publicOrigin: string;
}) {
  const base = options.supabaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}/functions/v1/html-api`);
  const incoming = new URLSearchParams(options.search.startsWith('?') ? options.search.slice(1) : options.search);
  incoming.forEach((value, key) => {
    if (key === 'public_origin' || key === 'x_route') return;
    url.searchParams.append(key, value);
  });
  url.searchParams.set('x_route', options.pathname);
  url.searchParams.set('public_origin', options.publicOrigin);
  return url;
}
