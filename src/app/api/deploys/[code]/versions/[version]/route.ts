import { NextRequest, NextResponse } from 'next/server';
import { supabase, DeploymentVersionRow } from '@/lib/db';
import { SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';
import { getStoragePathFromFilePath } from '@/lib/storage';
import { selectPrimaryVersion } from '@/lib/version-selection';
import { fetchDeploymentVersion, fetchDeploymentVersions } from '@/lib/deployment-queries';
import { patchDeployVersion } from '@/lib/deploy-service';
import { toNextResponse } from '@/lib/service-response';

export const dynamic = 'force-dynamic';

type DeploymentForVersionEdit = {
  id: string;
  code: string;
  current_version_id: string | null;
  primary_version_strategy?: 'likes' | 'latest' | null;
};

async function fetchDeploymentAndVersion(code: string, version: string) {
  if (!SHORT_CODE_PATTERN.test(code)) {
    return { error: 'INVALID_CODE' as const, status: 400, deployment: null, version: null };
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, code, current_version_id, primary_version_strategy')
    .eq('code', code)
    .maybeSingle();

  if (deploymentError || !deployment) {
    return {
      error: 'DEPLOYMENT_NOT_FOUND' as const,
      detail: deploymentError?.message,
      status: 404,
      deployment: null,
      version: null,
    };
  }

  const { data: selectedVersion, error: versionError } = await fetchDeploymentVersion(deployment.id, version);
  if (versionError || !selectedVersion) {
    return {
      error: 'DEPLOYMENT_VERSION_NOT_FOUND' as const,
      detail: versionError?.message,
      status: 404,
      deployment: null,
      version: null,
    };
  }

  return {
    error: null,
    status: 200,
    deployment: deployment as DeploymentForVersionEdit,
    version: selectedVersion as DeploymentVersionRow,
  };
}

async function fetchVersions(deploymentId: string) {
  return fetchDeploymentVersions(deploymentId);
}

async function syncDeploymentCurrent(deployment: DeploymentForVersionEdit) {
  const versions = await fetchVersions(deployment.id);
  const nextCurrent = selectPrimaryVersion(
    versions,
    deployment.current_version_id,
    deployment.primary_version_strategy || 'likes',
  );

  if (!nextCurrent) {
    return { currentVersion: null, versions };
  }

  const { error } = await supabase
    .from('deployments')
    .update({
      current_version_id: nextCurrent.id,
      title: nextCurrent.title,
      description: nextCurrent.description,
      filename: nextCurrent.filename,
      file_path: nextCurrent.file_path,
      file_size: nextCurrent.file_size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deployment.id);

  if (error) throw new Error(error.message);
  return { currentVersion: nextCurrent, versions };
}

function hasOnlyOneActiveVersion(versions: DeploymentVersionRow[], selectedVersionId: string) {
  const activeVersions = versions.filter((version) => (version.status || 'active') === 'active');
  return activeVersions.length <= 1 && activeVersions.some((version) => version.id === selectedVersionId);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> },
) {
  try {
    const { code, version } = await params;
    const result = await patchDeployVersion({
      supabase,
      contentType: request.headers.get('content-type') || '',
      rawBody: await request.text(),
      publicOrigin: request.nextUrl.origin,
      code,
      version,
    });
    return toNextResponse(result);
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '版本更新失败。',
      detail: getErrorMessage(error),
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> },
) {
  try {
    const { code, version } = await params;
    const found = await fetchDeploymentAndVersion(code, version);
    if (found.error || !found.deployment || !found.version) {
      return jsonError({
        status: found.status,
        code: found.error || 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: found.error === 'INVALID_CODE' ? '短链后缀格式不合法。' : '未找到对应版本。',
        detail: found.detail,
      });
    }

    if (Number(found.version.like_count ?? 0) > 0) {
      return jsonError({
        status: 423,
        code: 'DEPLOYMENT_VERSION_LOCKED_BY_LIKE',
        message: '该版本已被点赞锁定，不能删除。',
      });
    }

    const versionsBeforeDelete = await fetchVersions(found.deployment.id);
    if (versionsBeforeDelete.length <= 1) {
      return jsonError({
        status: 409,
        code: 'LAST_VERSION_CANNOT_DELETE',
        message: '不能删除最后一个版本；如需删除整个项目，请使用项目级删除。',
      });
    }

    if (hasOnlyOneActiveVersion(versionsBeforeDelete, found.version.id)) {
      return jsonError({
        status: 409,
        code: 'LAST_ACTIVE_VERSION',
        message: '不能删除最后一个可访问版本。',
      });
    }

    const storagePath = getStoragePathFromFilePath(found.version.file_path, code);
    const { error: deleteError } = await supabase
      .from('deployment_versions')
      .delete()
      .eq('id', found.version.id);

    if (deleteError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSION_DELETE_FAILED',
        message: '版本删除失败。',
        detail: deleteError.message,
      });
    }

    const { error: removeError } = await supabase.storage.from('deployments').remove([storagePath]);
    if (removeError) {
      console.error('Remove version file error:', removeError);
    }

    const { currentVersion } = await syncDeploymentCurrent(found.deployment);

    return NextResponse.json(
      {
        success: true,
        code,
        id: found.deployment.id,
        deletedVersionId: found.version.id,
        deletedVersionNumber: found.version.version_number,
        currentVersionId: currentVersion?.id ?? null,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '版本删除失败。',
      detail: getErrorMessage(error),
    });
  }
}
