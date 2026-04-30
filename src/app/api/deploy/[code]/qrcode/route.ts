import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, jsonError, NO_STORE } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ code: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const { code } = await context.params;
    const buffer = await QRCode.toBuffer(`${getRequestOrigin(request)}/s/${code}`, {
      margin: 1,
      width: 512,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': NO_STORE,
      },
    });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
