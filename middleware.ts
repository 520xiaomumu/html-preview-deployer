import { NextRequest, NextResponse } from 'next/server';
import { buildApiOffloadUrl, htmlApiOffloadEnabled, isOffloadedApiRequest } from '@/lib/api-offload';
import { isCorsEnabled } from '@/lib/cors-state';
import { NO_STORE_CACHE_CONTROL } from '@/lib/deploy-config';
import {
  hostedPageMethodAllowed,
  isHostedPagePath,
  isHtmlUploadRequest,
  uploadContentTypeAllowed,
} from '@/lib/origin-guard';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

const ROBOTS_HEADER = 'noindex, nofollow';

function withRobots(response: NextResponse, request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api') || request.nextUrl.searchParams.get('preview') === '1') {
    response.headers.set('X-Robots-Tag', ROBOTS_HEADER);
  }
  return response;
}

function unsupportedUploadResponse(contentType: string) {
  const multipart = contentType.toLowerCase().includes('multipart/form-data');
  return NextResponse.json(
    {
      success: false,
      error: multipart
        ? '当前接口不支持 multipart/form-data 上传。'
        : '仅支持 application/json 请求。',
      errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      detail: multipart
        ? '检测到 -F file 方式。请改用 application/json 并传 content + filename。'
        : `当前 Content-Type 为 ${contentType || 'unknown'}`,
      hint: '请设置 Content-Type: application/json，并在 body 中传 content 与 filename。',
      docs: '/api-docs',
      stage: 'validation',
    },
    {
      status: 415,
      headers: {
        'Cache-Control': NO_STORE_CACHE_CONTROL,
        'X-Robots-Tag': ROBOTS_HEADER,
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hosted pages are documents. Refuse writes here so the upload body never reaches a function.
  if (isHostedPagePath(pathname) && !hostedPageMethodAllowed(request.method)) {
    return new NextResponse('Method not allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD, OPTIONS',
        'Cache-Control': 'public, max-age=3600',
        'CDN-Cache-Control': 's-maxage=86400',
        'Vercel-CDN-Cache-Control': 's-maxage=86400',
        'X-Robots-Tag': ROBOTS_HEADER,
      },
    });
  }

  // JSON is required. Answering here avoids forwarding a rejected body into the function.
  if (isHtmlUploadRequest(pathname, request.method)) {
    const contentType = request.headers.get('content-type') || '';
    if (!uploadContentTypeAllowed(contentType)) {
      return unsupportedUploadResponse(contentType);
    }
  }

  // Publish bodies and content reads are large. Answer with a 307 before the
  // function runs so those bytes are not Fast Origin Transfer. skipMiddlewareRequestBody
  // already keeps the body out of middleware; the client follows to Supabase.
  if (htmlApiOffloadEnabled() && isOffloadedApiRequest(pathname, request.method)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const destination = buildApiOffloadUrl({
        supabaseUrl,
        pathname,
        search: request.nextUrl.search,
        publicOrigin: request.nextUrl.origin,
      });
      return NextResponse.redirect(destination, {
        status: 307,
        headers: {
          'Cache-Control': NO_STORE_CACHE_CONTROL,
          'X-Robots-Tag': ROBOTS_HEADER,
        },
      });
    }
  }

  const origin = request.headers.get('origin');
  if (!origin || origin === request.nextUrl.origin) {
    if (request.method === 'OPTIONS') {
      return withRobots(new NextResponse(null, { status: 204 }), request);
    }
    return withRobots(NextResponse.next(), request);
  }

  const corsOn = await isCorsEnabled();

  if (request.method === 'OPTIONS') {
    return withRobots(new NextResponse(null, {
      status: 204,
      headers: corsOn ? CORS_HEADERS : {},
    }), request);
  }

  const response = NextResponse.next();
  if (corsOn) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return withRobots(response, request);
}

export const config = {
  matcher: ['/api/:path*', '/s/:path*'],
};
