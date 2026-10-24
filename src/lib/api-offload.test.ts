import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiOffloadUrl, htmlApiOffloadEnabled, isOffloadedApiRequest } from './api-offload.ts';
import { isHtmlUploadRequest } from './origin-guard.ts';


test('offload follows the Supabase URL unless HTML_API_VIA disables it', () => {
  assert.equal(htmlApiOffloadEnabled({}), false);
  assert.equal(htmlApiOffloadEnabled({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), true);
  assert.equal(htmlApiOffloadEnabled({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    HTML_API_VIA: 'vercel',
  }), false);
  assert.equal(htmlApiOffloadEnabled({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    HTML_API_VIA: ' edge ',
  }), true);
});

test('write offload matches the upload guard, plus content reads', () => {
  const writes = [
    ['/api/deploy', 'POST'],
    ['/api/deploy/content', 'PATCH'],
    ['/api/deploys/my-page/versions/2', 'PATCH'],
    ['/api/deploys/my-page/versions/2/like', 'POST'],
    ['/api/deploy/abc', 'PATCH'],
  ] as const;
  for (const [pathname, method] of writes) {
    assert.equal(isOffloadedApiRequest(pathname, method), isHtmlUploadRequest(pathname, method));
  }
});

test('only HTML publish and content reads leave Vercel', () => {
  assert.equal(isOffloadedApiRequest('/api/deploy', 'POST'), true);
  assert.equal(isOffloadedApiRequest('/api/deploy/content', 'GET'), true);
  assert.equal(isOffloadedApiRequest('/api/deploy/content', 'PATCH'), true);
  assert.equal(isOffloadedApiRequest('/api/deploys/my-page/versions/2', 'PATCH'), true);
  assert.equal(isOffloadedApiRequest('/api/deploys/my-page/versions/2', 'DELETE'), false);
  assert.equal(isOffloadedApiRequest('/api/deploys/my-page/versions/2/like', 'POST'), false);
  assert.equal(isOffloadedApiRequest('/api/deploys', 'GET'), false);
  assert.equal(isOffloadedApiRequest('/api/deploy/abc', 'PATCH'), false);
});

test('offload URL keeps the route and the public origin', () => {
  const url = buildApiOffloadUrl({
    supabaseUrl: 'https://example.supabase.co/',
    pathname: '/api/deploy/content',
    search: '?code=my-page&version=2',
    publicOrigin: 'https://www.htmlcode.fun',
  });
  assert.equal(url.origin, 'https://example.supabase.co');
  assert.equal(url.pathname, '/functions/v1/html-api');
  assert.equal(url.searchParams.get('x_route'), '/api/deploy/content');
  assert.equal(url.searchParams.get('code'), 'my-page');
  assert.equal(url.searchParams.get('version'), '2');
  assert.equal(url.searchParams.get('public_origin'), 'https://www.htmlcode.fun');
});
