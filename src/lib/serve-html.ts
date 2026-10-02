import { NextResponse } from 'next/server';
import { htmlResponse } from '@/lib/api-response';
import {
  NO_STORE_CACHE_CONTROL,
  VERSION_HTML_CACHE_CONTROL,
  VERSION_HTML_EDGE_CACHE_CONTROL,
} from '@/lib/deploy-config';
import { supabase } from '@/lib/db';

type HtmlCacheProfile = 'current' | 'version';

export function noStoreRedirect(destination: URL | string) {
  return NextResponse.redirect(destination, {
    status: 307,
    headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL },
  });
}

export function cachedEdgeRedirect(destination: URL | string) {
  return NextResponse.redirect(destination, {
    status: 307,
    headers: {
      'Cache-Control': VERSION_HTML_CACHE_CONTROL,
      'CDN-Cache-Control': VERSION_HTML_EDGE_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': VERSION_HTML_EDGE_CACHE_CONTROL,
    },
  });
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
