import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { getSiteBySlug } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ code: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { code } = await context.params;
    const data = await getSiteBySlug(actor.ownerId, code, getRequestOrigin(request));
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
