import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { revokeAgentKey } from '@/server/agent-keys/service';
import { createRequestId, jsonError, jsonOk } from '@/server/http/responses';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const data = await revokeAgentKey(actor.ownerId, id);
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
