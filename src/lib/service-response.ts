import { NextResponse } from 'next/server';
import type { ServiceResult } from '@/lib/deploy-service';

export function toNextResponse(result: ServiceResult) {
  if (typeof result.text === 'string') {
    return new NextResponse(result.text, {
      status: result.status,
      headers: result.headers,
    });
  }

  return NextResponse.json(result.json ?? {}, {
    status: result.status,
    headers: result.headers,
  });
}
