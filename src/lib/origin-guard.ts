const HOSTED_PAGE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isHostedPagePath(pathname: string) {
  return pathname === '/s' || pathname.startsWith('/s/');
}

export function hostedPageMethodAllowed(method: string) {
  return HOSTED_PAGE_METHODS.has(method.toUpperCase());
}

export function isHtmlUploadRequest(pathname: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'POST' && pathname === '/api/deploy') return true;
  if (normalizedMethod === 'PATCH' && pathname === '/api/deploy/content') return true;
  return normalizedMethod === 'PATCH' && /^\/api\/deploys\/[^/]+\/versions\/[^/]+$/.test(pathname);
}

export function uploadContentTypeAllowed(contentType: string | null) {
  return (contentType || '').toLowerCase().includes('application/json');
}
