import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/server/auth/actor';
import { getSite, publishSiteVersion, readSiteContent } from '@/server/sites/service';
import { createRequestId, jsonError, jsonOk, NO_STORE, readJsonObject } from '@/server/http/responses';
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
    const content = await readSiteContent(actor.ownerId, id);

    if (request.nextUrl.searchParams.get('download') === '1') {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': NO_STORE,
        },
      });
    }

    return jsonOk(requestId, { content });
  } catch (error) {
    return jsonError(requestId, error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const site = await getSite(actor.ownerId, id, getRequestOrigin(request));
    const data = await publishSiteVersion({
      ownerId: actor.ownerId,
      actorId: actor.agentKeyId,
      slug: site.slug,
      content: body.content,
      filename: typeof body.filename === 'string' ? body.filename : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      description: body.description,
      visibility: body.visibility,
      message: body.message,
      origin: getRequestOrigin(request),
    });
    return jsonOk(requestId, data);
  } catch (error) {
    return jsonError(requestId, error);
  }
}
