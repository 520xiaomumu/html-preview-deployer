import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { listSites, publishSiteVersion } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk, readJsonObject } from '@/server/http/responses';
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

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const body = await readJsonObject(request);
    const data = await publishSiteVersion({
      ownerId: actor.ownerId,
      actorId: actor.agentKeyId,
      slug: body.slug || body.code || body.customCode,
      content: body.content,
      filename: body.filename,
      title: typeof body.title === 'string' ? body.title : undefined,
      description: body.description,
      visibility: typeof body.visibility === 'string' ? body.visibility : undefined,
      message: body.message,
      origin: getRequestOrigin(request),
    });
    return jsonOk(requestId, data, { status: 201 });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
