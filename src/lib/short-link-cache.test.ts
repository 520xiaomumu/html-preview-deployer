import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_SHORT_LINK_EDGE_CACHE_CONTROL,
  LIST_EDGE_CACHE_CONTROL,
  PREVIEW_REDIRECT_EDGE_CACHE_CONTROL,
  SHORT_LINK_EDGE_CACHE_CONTROL,
} from './deploy-config.ts';
import {
  canonicalShortLinkTarget,
  purgeTokensMatch,
  shortLinkCacheTag,
  shortLinkPurgeToken,
} from './short-link-cache.ts';

test('public short link expires in 60s and then blocks for a fresh primary', () => {
  assert.equal(SHORT_LINK_EDGE_CACHE_CONTROL, 's-maxage=60');
  assert.equal(SHORT_LINK_EDGE_CACHE_CONTROL.includes('stale-while-revalidate'), false);
});

test('preview and list lifetimes stay short when tag deletion does not run', () => {
  assert.equal(PREVIEW_REDIRECT_EDGE_CACHE_CONTROL, 's-maxage=900');
  assert.match(LIST_EDGE_CACHE_CONTROL, /s-maxage=300/);
  assert.match(LIST_EDGE_CACHE_CONTROL, /stale-while-revalidate=120/);
  assert.equal(CANONICAL_SHORT_LINK_EDGE_CACHE_CONTROL, 's-maxage=86400');
});

test('tracking params canonicalize onto the short link', () => {
  assert.equal(
    canonicalShortLinkTarget('https://www.htmlcode.fun/s/my-page?fbclid=abc&utm_source=x', 'my-page'),
    'https://www.htmlcode.fun/s/my-page',
  );
  assert.equal(
    canonicalShortLinkTarget('https://www.htmlcode.fun/s/my-page?fbclid=abc&preview=1', 'my-page'),
    'https://www.htmlcode.fun/s/my-page?preview=1',
  );
  assert.equal(canonicalShortLinkTarget('https://www.htmlcode.fun/s/my-page?preview=1', 'my-page'), null);
  assert.equal(canonicalShortLinkTarget('https://www.htmlcode.fun/s/my-page?preview=0', 'my-page'), 'https://www.htmlcode.fun/s/my-page');
  assert.equal(canonicalShortLinkTarget('https://www.htmlcode.fun/s/my-page', 'my-page'), null);
});

test('purge token is an HMAC of the lowercased code', () => {
  const token = shortLinkPurgeToken('secret', 'My-Page');
  assert.equal(token, shortLinkPurgeToken('secret', 'my-page'));
  assert.equal(shortLinkCacheTag('My-Page'), 'short-link-my-page');
  assert.equal(purgeTokensMatch('secret', 'my-page', token), true);
  assert.equal(purgeTokensMatch('secret', 'my-page', `${token.slice(0, -1)}0`), false);
  assert.equal(purgeTokensMatch('secret', 'other-page', token), false);
  assert.equal(purgeTokensMatch('other-secret', 'my-page', token), false);
  assert.equal(purgeTokensMatch('secret', 'my-page', 'short'), false);
});

test('webcrypto HMAC matches the node token the edge function copies', async () => {
  const secret = 'secret';
  const code = 'my-page';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`short-link:${code}`),
  );
  const hex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(hex, shortLinkPurgeToken(secret, code));
});
