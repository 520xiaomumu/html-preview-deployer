import { NextRequest } from 'next/server';

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
