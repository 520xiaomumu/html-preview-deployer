import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { supabase } from '@/lib/db';
import { postDeploy } from '@/lib/deploy-service';
import { toNextResponse } from '@/lib/service-response';
import { jsonError } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export async function POST(request: NextRequest) {
  try {
    const result = await postDeploy({
      supabase,
      contentType: request.headers.get('content-type') || '',
      rawBody: await request.text(),
      publicOrigin: request.nextUrl.origin,
      createQrPng: async (url) => new Uint8Array(await QRCode.toBuffer(url)),
    });
    return toNextResponse(result);
  } catch (error: unknown) {
    console.error('Deployment error:', error);
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '部署过程中发生未预期错误。',
      detail: getErrorMessage(error),
      stage: 'internal',
    });
  }
}
