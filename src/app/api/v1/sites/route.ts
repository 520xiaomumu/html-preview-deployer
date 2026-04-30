import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { listSites } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const data = await listSites(actor.ownerId, getRequestOrigin(request), request.nextUrl.searchParams);
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
