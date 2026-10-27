import { NextRequest } from 'next/server';
import { supabase } from '@/lib/db';
import { getDeployContent, patchDeployContent } from '@/lib/deploy-service';
import { toNextResponse } from '@/lib/service-response';
import { jsonError } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await getDeployContent({
      supabase,
      publicOrigin: request.nextUrl.origin,
      code: request.nextUrl.searchParams.get('code'),
      url: request.nextUrl.searchParams.get('url'),
      version: request.nextUrl.searchParams.get('version'),
      download: request.nextUrl.searchParams.get('download') === '1',
    });
    return toNextResponse(result);
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '读取部署内容失败。',
      detail: getErrorMessage(error),
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await patchDeployContent({
      supabase,
      contentType: request.headers.get('content-type') || '',
      rawBody: await request.text(),
      publicOrigin: request.nextUrl.origin,
    });
    return toNextResponse(result);
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '更新部署内容失败。',
      detail: getErrorMessage(error),
    });
  }
}
