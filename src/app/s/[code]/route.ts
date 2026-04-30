import { NextRequest, NextResponse } from 'next/server';
import { servePublicSite } from '@/server/sites/service';
import { createRequestId, jsonError } from '@/server/http/responses';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ code: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const { code } = await context.params;
    const { content, pinned } = await servePublicSite(code);
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': pinned
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, s-maxage=10, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
