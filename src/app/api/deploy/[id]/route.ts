import { NextRequest, NextResponse } from 'next/server';
import { DeploymentRow, DeploymentVersionRow, supabase } from '@/lib/db';
import { mapDeploymentRow, mapDeploymentVersionRow } from '@/lib/deployment-mapper';
import { getStoragePathFromFilePath, listHtmlPathsByCode } from '@/lib/storage';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';
import { jsonError } from '@/lib/api-response';

async function fetchDeploymentLockState(id: string) {
  const { data, error } = await supabase
    .from('deployments')
    .select('like_count')
    .eq('id', id)
    .maybeSingle();

  if (isMissingLikeCountError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('deployments')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    return {
      found: Boolean(fallbackData),
      locked: false,
      error: fallbackError?.message,
    };
  }

  return {
    found: Boolean(data),
    locked: Number(data?.like_count ?? 0) > 0,
    error: error?.message,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: error?.message,
      });
    }

    const formattedDeployment = mapDeploymentRow(deployment as DeploymentRow);
    const { data: versions, error: versionsError } = await supabase
      .from('deployment_versions')
      .select('*')
      .eq('deployment_id', deployment.id)
      .order('version_number', { ascending: false });

    return NextResponse.json({
      ...formattedDeployment,
      versions: versionsError ? [] : ((versions || []) as DeploymentVersionRow[]).map(mapDeploymentVersionRow),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['active', 'inactive'].includes(status)) {
      return jsonError({
        status: 400,
        code: 'INVALID_STATUS',
        message: 'status 必须是 active 或 inactive。',
      });
    }

    const lockState = await fetchDeploymentLockState(id);

    if (lockState.error || !lockState.found) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: lockState.error,
      });
    }

    if (lockState.locked) {
      return jsonError({
        status: 423,
        code: 'DEPLOYMENT_LOCKED_BY_LIKE',
        message: '该项目已被手动点赞，不能上下架。',
        hint: '如需修改状态，请先在网页中取消点赞，或创建一个新部署。',
      });
    }

    const { error } = await supabase
      .from('deployments')
      .update({ status })
      .eq('id', id);

    if (error) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_STATUS_UPDATE_FAILED',
        message: '部署状态更新失败。',
        detail: error.message,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '部署状态更新失败。',
      detail: getErrorMessage(error),
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get deployment info first to find files
    let { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('id, code, like_count')
      .eq('id', id)
      .maybeSingle();

    if (isMissingLikeCountError(fetchError)) {
      const fallback = await supabase
        .from('deployments')
        .select('id, code')
        .eq('id', id)
        .maybeSingle();

      deployment = fallback.data ? { ...fallback.data, like_count: 0 } : null;
      fetchError = fallback.error;
    }

    if (fetchError || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: fetchError?.message,
      });
    }

    const { code } = deployment;

    if (Number(deployment.like_count ?? 0) > 0) {
      return jsonError({
        status: 423,
        code: 'DEPLOYMENT_LOCKED_BY_LIKE',
        message: '该项目已被手动点赞，不能删除。',
        hint: '如需删除，请先在网页中取消点赞。',
      });
    }

    const bucket = supabase.storage.from('deployments');
    let htmlPaths: string[] = [];
    const { data: versions } = await supabase
      .from('deployment_versions')
      .select('file_path')
      .eq('deployment_id', deployment.id);

    htmlPaths = (versions || [])
      .map((version) => getStoragePathFromFilePath(version.file_path, code))
      .filter((path, index, paths) => path && paths.indexOf(path) === index);

    try {
      const discoveredPaths = await listHtmlPathsByCode(bucket, code);
      htmlPaths = Array.from(new Set([...htmlPaths, ...discoveredPaths]));
    } catch (listError) {
      console.error('Error listing html files from storage:', listError);
    }

    if (htmlPaths.length === 0) {
      htmlPaths.push(`html/${code}.html`);
    }

    const qrPath = `qrcodes/${code}.png`;

    const { error: storageError } = await bucket.remove([...htmlPaths, qrPath]);
      
    if (storageError) {
      console.error('Error deleting files from storage:', storageError);
      // We continue to delete from DB even if storage fails, or we could stop.
      // Usually better to clean up DB.
    }

    // Hard delete: Remove from DB
    const { error: deleteError } = await supabase
      .from('deployments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_DELETE_FAILED',
        message: '部署删除失败。',
        detail: deleteError.message,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '部署删除失败。',
      detail: getErrorMessage(error),
    });
  }
}
