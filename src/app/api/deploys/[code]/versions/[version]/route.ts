import { NextRequest, NextResponse } from 'next/server';
import { supabase, DeploymentVersionRow } from '@/lib/db';
import {
  MAX_HTML_SIZE_BYTES,
  SHORT_CODE_PATTERN,
  isValidHtmlContent,
  normalizeDescription,
} from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';
import { createVersionedHtmlPath, getStoragePathFromFilePath } from '@/lib/storage';
import { selectPrimaryVersion } from '@/lib/version-selection';

export const dynamic = 'force-dynamic';

type DeploymentForVersionEdit = {
  id: string;
  code: string;
  current_version_id: string | null;
};

function parseVersionSelector(version: string) {
  const versionNumber = Number(version);
  return Number.isInteger(versionNumber) && versionNumber > 0
    ? { versionNumber, versionId: null }
    : { versionNumber: null, versionId: version };
}

async function fetchDeploymentAndVersion(code: string, version: string) {
  if (!SHORT_CODE_PATTERN.test(code)) {
    return { error: 'INVALID_CODE' as const, status: 400, deployment: null, version: null };
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, code, current_version_id')
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

  const selector = parseVersionSelector(version);
  let versionQuery = supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deployment.id);

  versionQuery = selector.versionNumber
    ? versionQuery.eq('version_number', selector.versionNumber)
    : versionQuery.eq('id', selector.versionId);

  const { data: selectedVersion, error: versionError } = await versionQuery.maybeSingle();
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
  const { data, error } = await supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deploymentId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DeploymentVersionRow[];
}

async function syncDeploymentCurrent(deployment: DeploymentForVersionEdit) {
  const versions = await fetchVersions(deployment.id);
  const currentVersion = versions.find(
    (version) => version.id === deployment.current_version_id && (version.status || 'active') === 'active',
  );
  const nextCurrent = currentVersion || selectPrimaryVersion(versions, deployment.current_version_id);

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
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonError({ status: 415, code: 'UNSUPPORTED_CONTENT_TYPE', message: '仅支持 application/json 请求。' });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError({ status: 400, code: 'INVALID_PAYLOAD', message: '请求体必须是单个 JSON 对象。' });
    }

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
        message: '该版本已被点赞锁定，不能覆盖、下架或删除。',
        hint: '请创建新版本，或让用户在网页内取消该版本点赞后再操作。',
      });
    }

    const hasContent = typeof body.content === 'string';
    const requestedStatus = typeof body.status === 'string' ? body.status : undefined;
    if (requestedStatus && !['active', 'inactive'].includes(requestedStatus)) {
      return jsonError({ status: 400, code: 'INVALID_STATUS', message: 'status 必须是 active 或 inactive。' });
    }

    const versionsBeforeUpdate = await fetchVersions(found.deployment.id);
    if (requestedStatus === 'inactive' && hasOnlyOneActiveVersion(versionsBeforeUpdate, found.version.id)) {
      return jsonError({
        status: 409,
        code: 'LAST_ACTIVE_VERSION',
        message: '不能下架最后一个可访问版本。',
      });
    }

    const patch: Record<string, unknown> = {};
    let oldStoragePath: string | null = null;

    if (hasContent) {
      const normalizedContent = body.content.trim();
      if (!normalizedContent) {
        return jsonError({ status: 400, code: 'INVALID_CONTENT', message: 'content 必须是非空字符串。' });
      }

      const description = normalizeDescription(body.description);
      if (!description) {
        return jsonError({
          status: 400,
          code: 'DESCRIPTION_REQUIRED',
          message: '项目介绍不能为空。',
          detail: '覆盖版本时必须提供 description，哪怕只有一句话。',
        });
      }

      const fileSize = Buffer.byteLength(normalizedContent, 'utf8');
      if (fileSize > MAX_HTML_SIZE_BYTES) {
        return jsonError({
          status: 413,
          code: 'FILE_TOO_LARGE',
          message: 'HTML 文件体积超出限制。',
          detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
        });
      }

      if (!isValidHtmlContent(normalizedContent)) {
        return jsonError({
          status: 400,
          code: 'INVALID_HTML',
          message: '提交内容不是有效的 HTML 文本。',
          detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
        });
      }

      const filename = typeof body.filename === 'string' && body.filename.trim()
        ? body.filename.trim()
        : found.version.filename;
      if (!/\.html?$/i.test(filename)) {
        return jsonError({ status: 400, code: 'INVALID_FILENAME', message: 'filename 必须以 .html 或 .htm 结尾。' });
      }

      const storagePath = createVersionedHtmlPath(code, found.version.version_number);
      const bucket = supabase.storage.from('deployments');
      const { error: uploadError } = await bucket.upload(storagePath, normalizedContent, {
        contentType: 'text/html',
        upsert: true,
      });

      if (uploadError) {
        return jsonError({
          status: 500,
          code: 'HTML_VERSION_UPLOAD_FAILED',
          message: 'HTML 版本覆盖上传失败。',
          detail: uploadError.message,
        });
      }

      const {
        data: { publicUrl },
      } = bucket.getPublicUrl(storagePath);

      oldStoragePath = getStoragePathFromFilePath(found.version.file_path, code);
      patch.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : found.version.title;
      patch.description = description;
      patch.filename = filename;
      patch.file_path = publicUrl;
      patch.file_size = fileSize;
    }

    if (requestedStatus) {
      patch.status = requestedStatus;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError({
        status: 400,
        code: 'NO_CHANGES',
        message: '请提供 content 覆盖版本，或提供 status 上下架版本。',
      });
    }

    const { data: updatedVersion, error: updateError } = await supabase
      .from('deployment_versions')
      .update(patch)
      .eq('id', found.version.id)
      .select('*')
      .single();

    if (updateError || !updatedVersion) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSION_UPDATE_FAILED',
        message: '版本更新失败。',
        detail: updateError?.message,
      });
    }

    if (oldStoragePath && oldStoragePath !== getStoragePathFromFilePath(updatedVersion.file_path, code)) {
      const { error: removeError } = await supabase.storage.from('deployments').remove([oldStoragePath]);
      if (removeError) {
        console.error('Remove old version file error:', removeError);
      }
    }

    const { currentVersion } = await syncDeploymentCurrent(found.deployment);
    const origin = request.nextUrl.origin;

    return NextResponse.json(
      {
        success: true,
        code,
        id: found.deployment.id,
        versionId: updatedVersion.id,
        versionNumber: updatedVersion.version_number,
        status: updatedVersion.status || 'active',
        url: `${origin}/s/${code}`,
        detailUrl: `${origin}/deploy/${found.deployment.id}`,
        versionUrl: `${origin}/s/${code}/v/${updatedVersion.version_number}`,
        currentVersionId: currentVersion?.id ?? null,
        fileSize: updatedVersion.file_size,
        description: updatedVersion.description,
      },
      withNoStoreHeaders(),
    );
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
