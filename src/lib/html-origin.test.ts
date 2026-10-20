import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EDGE_REDIRECT_CACHE_CONTROL,
  VERSION_HTML_CACHE_CONTROL,
  VERSION_HTML_EDGE_CACHE_CONTROL,
} from './deploy-config.ts';
import {
  buildEdgeHtmlUrl,
  htmlServeViaEdge,
  isPubliclyVisible,
  planVersionServe,
  revisionFromStoragePath,
} from './html-origin.ts';
import {
  hostedPageMethodAllowed,
  isHtmlUploadRequest,
  isHostedPagePath,
  uploadContentTypeAllowed,
} from './origin-guard.ts';

test('revision is the storage object name', () => {
  assert.equal(
    revisionFromStoragePath('html/my-page/v2-1710000000000.html', 'fallback'),
    'v2-1710000000000.html',
  );
  assert.equal(revisionFromStoragePath('', 'version-id'), 'version-id');
});

test('public visibility requires an active deployment and version', () => {
  assert.equal(isPubliclyVisible('active', 'active'), true);
  assert.equal(isPubliclyVisible('active', null), true);
  assert.equal(isPubliclyVisible('active', 'inactive'), false);
  assert.equal(isPubliclyVisible('inactive', 'active'), false);
});

test('HTML_SERVE_VIA=edge is the only redirect mode', () => {
  assert.equal(htmlServeViaEdge({ HTML_SERVE_VIA: 'edge' }), true);
  assert.equal(htmlServeViaEdge({ HTML_SERVE_VIA: ' EDGE ' }), true);
  assert.equal(htmlServeViaEdge({}), false);
  assert.equal(htmlServeViaEdge({ HTML_SERVE_VIA: 'proxy' }), false);
});

test('edge URL stays on the function, with rev and optional preview', () => {
  const url = buildEdgeHtmlUrl({
    supabaseUrl: 'https://example.supabase.co/',
    code: 'my-page',
    version: 2,
    revision: 'v2-1710000000000.html',
  });
  assert.equal(
    url.toString(),
    'https://example.supabase.co/functions/v1/serve-deployment-html?code=my-page&version=2&rev=v2-1710000000000.html',
  );
  assert.equal(url.pathname.includes('/object/public/'), false);

  const preview = buildEdgeHtmlUrl({
    supabaseUrl: 'https://example.supabase.co',
    code: 'my-page',
    version: 2,
    revision: 'v2-1710000000000.html',
    preview: true,
  });
  assert.equal(preview.searchParams.get('preview'), '1');
});

test('matching rev serves without another revision redirect', () => {
  const plan = planVersionServe({
    isPreview: false,
    revision: 'v1-1.html',
    expectedRevision: 'v1-1.html',
    publiclyVisible: true,
    serveViaEdge: false,
  });
  assert.deepEqual(plan, { kind: 'proxy', preview: false, cacheable: true });
});

test('missing rev redirects once and counts a public view', () => {
  const plan = planVersionServe({
    isPreview: false,
    revision: null,
    expectedRevision: 'v1-1.html',
    publiclyVisible: true,
    serveViaEdge: true,
  });
  assert.deepEqual(plan, {
    kind: 'redirect-revision',
    countView: true,
    revision: 'v1-1.html',
  });
});

test('preview with a wrong rev does not count a view', () => {
  const plan = planVersionServe({
    isPreview: true,
    revision: 'old.html',
    expectedRevision: 'v1-1.html',
    publiclyVisible: true,
    serveViaEdge: false,
  });
  assert.deepEqual(plan, {
    kind: 'redirect-revision',
    countView: false,
    revision: 'v1-1.html',
  });
});

test('edge mode redirects a matching public rev without proxying bytes', () => {
  const plan = planVersionServe({
    isPreview: true,
    revision: 'v1-1.html',
    expectedRevision: 'v1-1.html',
    publiclyVisible: true,
    serveViaEdge: true,
  });
  assert.deepEqual(plan, {
    kind: 'redirect-edge',
    preview: false,
    cacheable: true,
    revision: 'v1-1.html',
  });
});

test('inactive preview stays on the app unless edge mode is enabled', () => {
  assert.deepEqual(planVersionServe({
    isPreview: true,
    revision: 'v1-1.html',
    expectedRevision: 'v1-1.html',
    publiclyVisible: false,
    serveViaEdge: false,
  }), { kind: 'proxy', preview: true, cacheable: false });

  assert.deepEqual(planVersionServe({
    isPreview: true,
    revision: null,
    expectedRevision: 'v1-1.html',
    publiclyVisible: false,
    serveViaEdge: true,
  }), {
    kind: 'redirect-edge',
    preview: true,
    cacheable: false,
    revision: 'v1-1.html',
  });
});

test('version HTML is immutable and the edge redirect is not', () => {
  assert.match(VERSION_HTML_CACHE_CONTROL, /immutable/);
  assert.match(VERSION_HTML_EDGE_CACHE_CONTROL, /s-maxage=31536000/);
  assert.equal(EDGE_REDIRECT_CACHE_CONTROL.includes('immutable'), false);
  assert.match(EDGE_REDIRECT_CACHE_CONTROL, /s-maxage=3600/);
});

test('hosted pages only accept reads, and HTML uploads must be JSON', () => {
  assert.equal(isHostedPagePath('/s/my-page'), true);
  assert.equal(isHostedPagePath('/s/my-page/v/2'), true);
  assert.equal(isHostedPagePath('/api/deploy'), false);
  assert.equal(hostedPageMethodAllowed('GET'), true);
  assert.equal(hostedPageMethodAllowed('HEAD'), true);
  assert.equal(hostedPageMethodAllowed('POST'), false);

  assert.equal(isHtmlUploadRequest('/api/deploy', 'POST'), true);
  assert.equal(isHtmlUploadRequest('/api/deploy/content', 'PATCH'), true);
  assert.equal(isHtmlUploadRequest('/api/deploys/my-page/versions/2', 'PATCH'), true);
  assert.equal(isHtmlUploadRequest('/api/deploys/my-page/versions/2/like', 'POST'), false);
  assert.equal(uploadContentTypeAllowed('application/json; charset=utf-8'), true);
  assert.equal(uploadContentTypeAllowed('multipart/form-data; boundary=x'), false);
  assert.equal(uploadContentTypeAllowed(null), false);
});
