import { NextResponse } from 'next/server';
import { htmlResponse } from '@/lib/api-response';
import {
  EDGE_REDIRECT_CACHE_CONTROL,
  EDGE_REDIRECT_EDGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  PREVIEW_REDIRECT_CACHE_CONTROL,
  PREVIEW_REDIRECT_EDGE_CACHE_CONTROL,
} from '@/lib/deploy-config';
import { supabase } from '@/lib/db';

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

export function cachedPreviewRedirect(destination: URL | string) {
  return cachedRedirect(
    destination,
    PREVIEW_REDIRECT_CACHE_CONTROL,
    PREVIEW_REDIRECT_EDGE_CACHE_CONTROL,
    { 'X-Robots-Tag': 'noindex, nofollow' },
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

  const content = await fileData.text();
  return htmlResponse(content, preview, undefined, cacheProfile);
}
