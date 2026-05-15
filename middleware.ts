import { NextRequest, NextResponse } from 'next/server';
import { isCorsEnabled } from '@/lib/cors-state';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export async function middleware(request: NextRequest) {
  const corsOn = await isCorsEnabled();

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsOn ? CORS_HEADERS : {},
    });
  }

  const response = NextResponse.next();
  if (corsOn) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/s/:path*'],
};
