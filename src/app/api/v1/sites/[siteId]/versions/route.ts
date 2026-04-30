import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { listSiteVersions } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ siteId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { siteId } = await context.params;
    const data = await listSiteVersions(actor.ownerId, siteId, getRequestOrigin(request));
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
