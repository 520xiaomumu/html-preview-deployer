import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AppError, toAppError } from '@/server/errors';

export type ApiSuccess<T> = {
  success: true;
  requestId: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  requestId: string;
  errorCode: string;
  error: string;
  detail?: string;
};

export const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0';
export const PUBLIC_HTML_CACHE = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600';

export function createRequestId() {
  return randomUUID();
}

export function jsonOk<T>(requestId: string, data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      success: true,
      requestId,
      data,
    },
    {
      ...(init || {}),
      headers: {
        'Cache-Control': NO_STORE,
        ...(init?.headers || {}),
      },
    }
  );
}

export function jsonError(requestId: string, error: unknown) {
  const appError = toAppError(error);
  const body: ApiFailure = {
    success: false,
    requestId,
    errorCode: appError.code,
    error: appError.message,
    detail: appError.detail,
  };

  return NextResponse.json(body, {
    status: appError.status,
    headers: {
      'Cache-Control': NO_STORE,
    },
  });
}

export async function readJsonObject(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new AppError(415, 'INVALID_PAYLOAD', 'Only application/json requests are supported.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.', String(error));
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'Request body must be a JSON object.');
  }

  return body as Record<string, unknown>;
}
