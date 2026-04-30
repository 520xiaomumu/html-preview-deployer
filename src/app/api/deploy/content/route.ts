import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/server/errors';
import { requireActor } from '@/server/auth/actor';
import {
  getSiteBySlug,
  publishSiteVersion,
  readSiteContentBySlug,
} from '@/server/sites/service';
import { createRequestId, jsonError, NO_STORE, readJsonObject } from '@/server/http/responses';
import { getRequestOrigin } from '@/server/http/origin';

export const dynamic = 'force-dynamic';

function resolveCode(request: NextRequest, body?: Record<string, unknown>) {
  const code = request.nextUrl.searchParams.get('code') || body?.code;
  if (typeof code === 'string' && code.trim()) return code.trim();

  const url = request.nextUrl.searchParams.get('url') || body?.url;
  if (typeof url === 'string' && url.trim()) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 's' && parts[1]) return parts[1];
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const code = resolveCode(request);
    if (!code) throw new AppError(400, 'INVALID_CODE', 'code or url is required.');

    const site = await getSiteBySlug(actor.ownerId, code, getRequestOrigin(request));
    const content = await readSiteContentBySlug(actor.ownerId, site.slug);

    if (request.nextUrl.searchParams.get('download') === '1') {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': NO_STORE,
        },
      });
    }

    return Response.json({
      success: true,
      requestId,
      id: site.id,
      siteId: site.id,
      code: site.slug,
      slug: site.slug,
      title: site.title,
      visibility: site.visibility,
      url: site.url,
      content,
    });
  } catch (error) {
    return jsonError(requestId, error);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const actor = await requireActor(request);
    const body = await readJsonObject(request);
    const code = resolveCode(request, body);
    if (!code) throw new AppError(400, 'INVALID_CODE', 'code or url is required.');

    const updated = await publishSiteVersion({
      ownerId: actor.ownerId,
      actorId: actor.agentKeyId,
      slug: code,
      content: body.content,
      filename: typeof body.filename === 'string' ? body.filename : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      description: body.description,
      message: body.message,
      visibility: body.visibility,
      origin: getRequestOrigin(request),
    });

    return Response.json({
      success: true,
      requestId,
      id: updated.siteId,
      siteId: updated.siteId,
      versionId: updated.versionId,
      versionNumber: updated.versionNumber,
      changed: updated.changed,
      code: updated.slug,
      slug: updated.slug,
      url: updated.url,
      versionUrl: updated.versionUrl,
    });
  } catch (error) {
    return jsonError(requestId, error);
  }
}
