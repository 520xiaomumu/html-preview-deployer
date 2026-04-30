import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { createAgentKey, listAgentKeys } from '@/server/agent-keys/service';
import { createRequestId, jsonError, jsonOk, readJsonObject } from '@/server/http/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const data = await listAgentKeys(actor.ownerId);
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const body = await readJsonObject(request);
    const data = await createAgentKey(actor.ownerId, body.name);
    return jsonOk(requestId, data, { status: 201 });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
