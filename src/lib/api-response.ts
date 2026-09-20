import { NextRequest, NextResponse } from 'next/server';
import {
  CDN_CACHE_CONTROL,
  CDN_EDGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  VERSION_HTML_CACHE_CONTROL,
  VERSION_HTML_EDGE_CACHE_CONTROL,
} from '@/lib/deploy-config';

type HtmlCacheProfile = 'current' | 'version';

type JsonErrorOptions = {
  status: number;
  message: string;
  code: string;
  requestId?: string;
  detail?: string;
  hint?: string;
  docs?: string;
  stage?: string;
  extras?: Record<string, unknown>;
  cacheControl?: string;
  retryAfterSeconds?: number;
};

export function jsonError(options: JsonErrorOptions) {
  const headers: Record<string, string> = {
    'Cache-Control': options.cacheControl || NO_STORE_CACHE_CONTROL,
  };

  if (typeof options.retryAfterSeconds === 'number') {
    headers['Retry-After'] = String(options.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      success: false,
      error: options.message,
      errorCode: options.code,
      detail: options.detail,
      hint: options.hint,
      docs: options.docs,
      stage: options.stage,
      requestId: options.requestId,
      retryAfterSeconds: options.retryAfterSeconds,
      ...(options.extras || {}),
    },
    {
      status: options.status,
      headers,
    }
  );
}

export function withNoStoreHeaders(init?: ResponseInit): ResponseInit {
  return {
    ...(init || {}),
    headers: {
      ...(init?.headers || {}),
      'Cache-Control': NO_STORE_CACHE_CONTROL,
    },
  };
}

export function isSameOriginBrowserRequest(request: NextRequest) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const currentOrigin = request.nextUrl.origin;
  const fetchSite = request.headers.get('sec-fetch-site');

  return (origin === currentOrigin || Boolean(referer?.startsWith(`${currentOrigin}/`)))
    && (fetchSite === 'same-origin' || fetchSite === 'none');
}

export function manualLikeRequiredError(action: 'like' | 'unlike') {
  return jsonError({
    status: 403,
    code: action === 'like' ? 'MANUAL_LIKE_REQUIRED' : 'MANUAL_UNLIKE_REQUIRED',
    message: action === 'like'
      ? '点赞只能从 htmlcode.fun 网页内手动操作，Agent 不能通过 API 点赞。'
      : '取消点赞只能从 htmlcode.fun 网页内手动操作，Agent 不能通过 API 取消点赞。',
    hint: action === 'like'
      ? '请把部署详情页链接交给用户，让用户在浏览器里手动点赞。'
      : '请让用户在浏览器里手动操作。',
  });
}

export function htmlResponse(
  content: string,
  preview = false,
  downloadFilename?: string,
  cacheProfile: HtmlCacheProfile = 'current',
) {
  const noStore = preview || Boolean(downloadFilename);
  const cacheControl = cacheProfile === 'version' ? VERSION_HTML_CACHE_CONTROL : CDN_CACHE_CONTROL;
  const edgeCacheControl = cacheProfile === 'version' ? VERSION_HTML_EDGE_CACHE_CONTROL : CDN_EDGE_CACHE_CONTROL;
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': noStore ? NO_STORE_CACHE_CONTROL : cacheControl,
  };

  if (downloadFilename) {
    headers['Content-Disposition'] = `attachment; filename="${downloadFilename}"`;
  } else if (!preview) {
    headers['CDN-Cache-Control'] = edgeCacheControl;
    headers['Vercel-CDN-Cache-Control'] = edgeCacheControl;
  }

  return new NextResponse(content, { headers });
}
