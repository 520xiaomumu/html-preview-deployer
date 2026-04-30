import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { rollbackSite } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk, readJsonObject } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ siteId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { siteId } = await context.params;
    const body = await readJsonObject(request);
    const data = await rollbackSite(actor.ownerId, siteId, body.version, getRequestOrigin(request));
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
