import { NextResponse } from 'next/server';
import { NO_STORE_CACHE_CONTROL } from '@/lib/deploy-config';

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
