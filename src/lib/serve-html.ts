import { NextResponse } from 'next/server';
import { htmlDocumentHeaders } from '@/lib/api-response';
import {
  EDGE_REDIRECT_CACHE_CONTROL,
  EDGE_REDIRECT_EDGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  PREVIEW_REDIRECT_CACHE_CONTROL,
  PREVIEW_REDIRECT_EDGE_CACHE_CONTROL,
  SHORT_LINK_CACHE_CONTROL,
  SHORT_LINK_EDGE_CACHE_CONTROL,
} from '@/lib/deploy-config';
import { supabase } from '@/lib/db';
import { shortLinkCacheTag } from '@/lib/short-link-cache';

type HtmlCacheProfile = 'current' | 'version';

export function noStoreRedirect(destination: URL | string) {
  return NextResponse.redirect(destination, {
    status: 307,
    headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL },
  });
}

export function cachedRedirect(
  destination: URL | string,
  cacheControl: string,
  edgeCacheControl: string,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.redirect(destination, {
    status: 307,
    headers: {
      'Cache-Control': cacheControl,
      'CDN-Cache-Control': edgeCacheControl,
      'Vercel-CDN-Cache-Control': edgeCacheControl,
      ...(extraHeaders || {}),
    },
  });
}

export function cachedEdgeRedirect(destination: URL | string) {
  return cachedRedirect(
    destination,
    EDGE_REDIRECT_CACHE_CONTROL,
    EDGE_REDIRECT_EDGE_CACHE_CONTROL,
  );
}

export function cachedShortLinkRedirect(destination: URL | string, code: string) {
  return cachedRedirect(
    destination,
    SHORT_LINK_CACHE_CONTROL,
    SHORT_LINK_EDGE_CACHE_CONTROL,
    { 'Vercel-Cache-Tag': shortLinkCacheTag(code) },
  );
}

export function cachedPreviewRedirect(destination: URL | string, code: string) {
  return cachedRedirect(
    destination,
    PREVIEW_REDIRECT_CACHE_CONTROL,
    PREVIEW_REDIRECT_EDGE_CACHE_CONTROL,
    {
      'X-Robots-Tag': 'noindex, nofollow',
      'Vercel-Cache-Tag': shortLinkCacheTag(code),
    },
  );
}

export async function proxyStoredHtml(
  storagePath: string,
  preview: boolean,
  cacheProfile: HtmlCacheProfile = 'version',
) {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('deployments')
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error('Download error:', downloadError);
    return new NextResponse('File content not found', { status: 404 });
  }

  // Stream the storage bytes through. Decoding the whole file to a string and
  // encoding it again is CPU, and these documents are up to 1 MB.
  const headers = htmlDocumentHeaders(preview, undefined, cacheProfile);
  if (typeof fileData.size === 'number' && Number.isFinite(fileData.size)) {
    headers['Content-Length'] = String(fileData.size);
  }
  const body = typeof fileData.stream === 'function' ? fileData.stream() : fileData;
  return new NextResponse(body, { headers });
}
