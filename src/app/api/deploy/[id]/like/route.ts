import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';

export const dynamic = 'force-dynamic';

function isSameOriginBrowserRequest(request: NextRequest) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const currentOrigin = request.nextUrl.origin;
  const fetchSite = request.headers.get('sec-fetch-site');

  const hasSameOriginHeader = origin === currentOrigin || Boolean(referer?.startsWith(`${currentOrigin}/`));
  const looksBrowserInitiated = fetchSite === 'same-origin' || fetchSite === 'none';

  return hasSameOriginHeader && looksBrowserInitiated;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return jsonError({
        status: 403,
        code: 'MANUAL_LIKE_REQUIRED',
        message: '点赞只能从网页内手动操作。',
      });
    }

    const { id } = await params;
    const { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('id, status, like_count')
      .eq('id', id)
      .maybeSingle();

    if (isMissingLikeCountError(fetchError)) {
      return jsonError({
        status: 503,
        code: 'LIKE_MIGRATION_REQUIRED',
        message: '点赞功能还没完成数据库升级。',
        detail: '请先执行 npm run supabase:db:push，将 like_count 字段推到 Supabase。',
      });
    }

    if (fetchError || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: fetchError?.message,
      });
    }

    if (deployment.status !== 'active') {
      return jsonError({
        status: 409,
        code: 'DEPLOYMENT_INACTIVE',
        message: '已下架项目不能点赞。',
      });
    }

    const { data: likeCount, error: likeError } = await supabase.rpc(
      'increment_deployment_like_count',
      { target_id: id }
    );

    if (likeError) {
      return jsonError({
        status: 500,
        code: 'LIKE_FAILED',
        message: '点赞失败。',
        detail: likeError.message,
      });
    }

    return NextResponse.json(
      {
        success: true,
        id,
        likeCount: Number(likeCount ?? deployment.like_count ?? 0),
        locked: true,
      },
      withNoStoreHeaders()
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '点赞失败。',
      detail: getErrorMessage(error),
    });
  }
}
