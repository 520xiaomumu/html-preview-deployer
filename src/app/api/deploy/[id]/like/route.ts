import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';
import { DeploymentVersionRow } from '@/lib/db';
import { selectPrimaryVersion } from '@/lib/version-selection';

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
      .select('id, status, like_count, current_version_id')
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

    const { data: versions, error: versionsError } = await supabase
      .from('deployment_versions')
      .select('id, version_number, like_count')
      .eq('deployment_id', id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSIONS_FETCH_FAILED',
        message: '版本历史读取失败。',
        detail: versionsError.message,
      });
    }

    const primaryVersion = selectPrimaryVersion((versions || []) as DeploymentVersionRow[], deployment.current_version_id);
    if (!primaryVersion) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: '未找到可点赞版本。',
      });
    }

    const { data: likeRows, error: likeError } = await supabase.rpc(
      'increment_deployment_version_like_count',
      { target_version_id: primaryVersion.id }
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
        versionId: primaryVersion.id,
        versionLikeCount: Number(likeRows?.[0]?.version_like_count ?? primaryVersion.like_count ?? 0),
        likeCount: Number(likeRows?.[0]?.deployment_like_count ?? deployment.like_count ?? 0),
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return jsonError({
        status: 403,
        code: 'MANUAL_UNLIKE_REQUIRED',
        message: '取消点赞只能从网页内手动操作。',
      });
    }

    const { id } = await params;
    const { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('id, current_version_id, like_count')
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

    const { data: versions, error: versionsError } = await supabase
      .from('deployment_versions')
      .select('id, version_number, like_count')
      .eq('deployment_id', id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSIONS_FETCH_FAILED',
        message: '版本历史读取失败。',
        detail: versionsError.message,
      });
    }

    const primaryVersion = selectPrimaryVersion((versions || []) as DeploymentVersionRow[], deployment.current_version_id);
    if (!primaryVersion) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: '未找到可取消点赞版本。',
      });
    }

    const { data: likeRows, error: unlikeError } = await supabase.rpc(
      'decrement_deployment_version_like_count',
      { target_version_id: primaryVersion.id }
    );

    if (unlikeError) {
      return jsonError({
        status: 500,
        code: 'UNLIKE_FAILED',
        message: '取消点赞失败。',
        detail: unlikeError.message,
      });
    }

    const resolvedLikeCount = Number(likeRows?.[0]?.deployment_like_count ?? deployment.like_count ?? 0);

    return NextResponse.json(
      {
        success: true,
        id,
        versionId: primaryVersion.id,
        versionLikeCount: Number(likeRows?.[0]?.version_like_count ?? primaryVersion.like_count ?? 0),
        likeCount: resolvedLikeCount,
        locked: resolvedLikeCount > 0,
      },
      withNoStoreHeaders()
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '取消点赞失败。',
      detail: getErrorMessage(error),
    });
  }
}
