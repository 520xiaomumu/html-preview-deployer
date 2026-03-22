import { NextResponse } from 'next/server';
import { NO_STORE_CACHE_CONTROL } from '@/lib/deploy-config';

type JsonErrorOptions = {
  status: number;
  message: string;
  code: string;
  requestId?: string;
  detail?: string;
  extras?: Record<string, unknown>;
  cacheControl?: string;
};

export function jsonError(options: JsonErrorOptions) {
  return NextResponse.json(
    {
      success: false,
      error: options.message,
      errorCode: options.code,
      detail: options.detail,
      requestId: options.requestId,
      ...(options.extras || {}),
    },
    {
      status: options.status,
      headers: {
        'Cache-Control': options.cacheControl || NO_STORE_CACHE_CONTROL,
      },
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
