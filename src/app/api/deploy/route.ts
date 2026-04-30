import { NextRequest } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { publishSiteVersion } from '@/server/sites/service';
import { createRequestId, jsonError, readJsonObject } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const body = await readJsonObject(request);
    const deployment = await publishSiteVersion({
      ownerId: actor.ownerId,
      actorId: actor.agentKeyId,
      slug: typeof body.customCode === 'string'
        ? body.customCode
        : typeof body.code === 'string'
          ? body.code
          : typeof body.slug === 'string'
            ? body.slug
            : undefined,
      content: body.content,
      filename: typeof body.filename === 'string' ? body.filename : 'index.html',
      title: typeof body.title === 'string' ? body.title : undefined,
      description: body.description,
      visibility: body.visibility,
      message: body.message,
      origin: getRequestOrigin(request),
    });

    return Response.json({
      success: true,
      id: deployment.siteId,
      siteId: deployment.siteId,
      versionId: deployment.versionId,
      versionNumber: deployment.versionNumber,
      changed: deployment.changed,
      code: deployment.slug,
      url: deployment.url,
      versionUrl: deployment.versionUrl,
      qrCode: `${getRequestOrigin(request)}/api/deploy/${deployment.slug}/qrcode`,
      requestId,
      actorId: actor.id,
      authenticated: actor.authenticated,
    }, { status: deployment.changed ? 201 : 200 });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
