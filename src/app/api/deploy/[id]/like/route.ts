import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import {
  isSameOriginBrowserRequest,
  jsonError,
  manualLikeRequiredError,
  withNoStoreHeaders,
} from '@/lib/api-response';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';
import { DeploymentVersionRow } from '@/lib/db';
import { selectPrimaryVersion } from '@/lib/version-selection';
import { purgePublishedPage } from '@/lib/purge-cache';

export const dynamic = 'force-dynamic';

async function updatePrimaryVersionLike(id: string, action: 'increment' | 'decrement') {
  const isLike = action === 'increment';
  const { data: deployment, error: fetchError } = await supabase
    .from('deployments')
    .select('id, code, status, like_count, current_version_id, primary_version_strategy')
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

  if (isLike && deployment.status !== 'active') {
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

  const primaryVersion = selectPrimaryVersion(
    (versions || []) as DeploymentVersionRow[],
    deployment.current_version_id,
    deployment.primary_version_strategy || 'likes',
  );
  if (!primaryVersion) {
    return jsonError({
      status: 404,
      code: 'DEPLOYMENT_VERSION_NOT_FOUND',
      message: isLike ? '未找到可点赞版本。' : '未找到可取消点赞版本。',
    });
  }

  const { data: likeRows, error: likeError } = await supabase.rpc(
    isLike ? 'increment_deployment_version_like_count' : 'decrement_deployment_version_like_count',
    { target_version_id: primaryVersion.id },
  );

  if (likeError) {
    return jsonError({
      status: 500,
      code: isLike ? 'LIKE_FAILED' : 'UNLIKE_FAILED',
      message: isLike ? '点赞失败。' : '取消点赞失败。',
      detail: likeError.message,
    });
  }

  const likeCount = Number(likeRows?.[0]?.deployment_like_count ?? deployment.like_count ?? 0);
  await purgePublishedPage(deployment.code);

  return NextResponse.json(
    {
      success: true,
      id,
      versionId: primaryVersion.id,
      versionLikeCount: Number(likeRows?.[0]?.version_like_count ?? primaryVersion.like_count ?? 0),
      likeCount,
      locked: isLike || likeCount > 0,
    },
    withNoStoreHeaders(),
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return manualLikeRequiredError('like');
    }

    const { id } = await params;
    return updatePrimaryVersionLike(id, 'increment');
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
      return manualLikeRequiredError('unlike');
    }

    const { id } = await params;
    return updatePrimaryVersionLike(id, 'decrement');
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '取消点赞失败。',
      detail: getErrorMessage(error),
    });
  }
}
