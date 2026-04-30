import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { getSite } from '@/server/sites/service';
import { createRequestId, jsonError, NO_STORE } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const site = await getSite(actor.ownerId, id, getRequestOrigin(request));
    const file = await QRCode.toBuffer(site.url, { margin: 1, width: 512 });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': NO_STORE,
      },
    });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
