import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { deleteSite, getSite, updateSiteMeta } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk, readJsonObject } from '@/server/http/responses';
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
    const data = await getSite(actor.ownerId, id, getRequestOrigin(request));
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const data = await updateSiteMeta(actor.ownerId, id, getRequestOrigin(request), {
      visibility: body.visibility,
      title: body.title,
      description: body.description,
    });
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const data = await deleteSite(actor.ownerId, id);
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
