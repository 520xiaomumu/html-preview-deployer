import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { publishSiteVersion } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk, readJsonObject } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const body = await readJsonObject(request);
    const data = await publishSiteVersion({
      ownerId: actor.ownerId,
      actorId: actor.agentKeyId,
      slug: body.slug || body.site || body.code || body.customCode,
      content: body.content,
      filename: body.filename,
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      message: body.message,
      origin: getRequestOrigin(request),
    });
    return jsonOk(requestId, data, { status: data.changed ? 201 : 200 });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
