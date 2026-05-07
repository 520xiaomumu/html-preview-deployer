import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { randomUUID } from 'crypto';
import {
  MAX_HTML_SIZE_BYTES,
  SHORT_CODE_PATTERN,
  NO_STORE_CACHE_CONTROL,
  isValidHtmlContent,
  normalizeDescription,
  resolveCodeFromInput,
} from '@/lib/deploy-config';
import { createVersionedHtmlPath, getStoragePathFromFilePath } from '@/lib/storage';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';
import { fetchDeploymentByCode, getNextVersionNumber } from '@/lib/deployment-queries';
import { selectPrimaryVersion } from '@/lib/version-selection';

export const dynamic = 'force-dynamic';

type DeploymentVersionRecord = {
  id: string;
  version_number: number;
  filename: string;
  file_path: string;
  file_size: number | null;
  title: string | null;
  description: string | null;
  created_at: string;
  like_count: number | null;
};

function resolveStoragePath(deployment: { file_path?: string | null }, code: string) {
  return getStoragePathFromFilePath(deployment.file_path, code);
}

async function readHtmlContent(storagePath: string) {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('deployments')
    .download(storagePath);

  if (downloadError || !fileData) {
    return { error: downloadError?.message || 'File not found', content: null };
  }

  const content = await fileData.text();
  return { error: null, content };
}

async function fetchRequestedVersion(deploymentId: string, requestedVersion: string | null) {
  if (!requestedVersion) return { version: null, error: null };

  const versionQuery = supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deploymentId);

  const parsedVersionNumber = Number(requestedVersion);
  const result = Number.isInteger(parsedVersionNumber) && parsedVersionNumber > 0
    ? await versionQuery.eq('version_number', parsedVersionNumber).maybeSingle()
    : await versionQuery.eq('id', requestedVersion).maybeSingle();

  return {
    version: (result.data || null) as DeploymentVersionRecord | null,
    error: result.error,
  };
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const code = resolveCodeFromInput({
      code: request.nextUrl.searchParams.get('code'),
      url: request.nextUrl.searchParams.get('url'),
    });

    if (!code || !SHORT_CODE_PATTERN.test(code)) {
      return jsonError({
        status: 400,
        code: 'INVALID_CODE_OR_URL',
        message: '请提供有效的 code 或部署 url。',
        detail: '示例: ?code=abc123 或 ?url=https://www.htmlcode.fun/s/abc123',
        requestId,
      });
    }

    const { data: deployment, error } = await fetchDeploymentByCode(code);
    if (error || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: error?.message,
        requestId,
      });
    }

    const { version: selectedVersion, error: versionError } = await fetchRequestedVersion(
      deployment.id,
      request.nextUrl.searchParams.get('version'),
    );

    if (versionError || (request.nextUrl.searchParams.get('version') && !selectedVersion)) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: '未找到指定版本。',
        detail: versionError?.message,
        requestId,
      });
    }

    let resolvedVersion = selectedVersion;
    if (!resolvedVersion) {
      const { data: versions, error: versionsError } = await supabase
        .from('deployment_versions')
        .select('*')
        .eq('deployment_id', deployment.id)
        .order('version_number', { ascending: false });

      if (versionsError) {
        return jsonError({
          status: 500,
          code: 'DEPLOYMENT_VERSIONS_FETCH_FAILED',
          message: '版本历史读取失败。',
          detail: versionsError.message,
          requestId,
        });
      }

      resolvedVersion = selectPrimaryVersion((versions || []) as DeploymentVersionRecord[], deployment.current_version_id);
    }

    const storagePath = resolvedVersion
      ? getStoragePathFromFilePath(resolvedVersion.file_path, code)
      : resolveStoragePath(deployment, code);
    const { error: readError, content } = await readHtmlContent(storagePath);
    if (readError || content == null) {
      return jsonError({
        status: 404,
        code: 'HTML_CONTENT_NOT_FOUND',
        message: '未找到该部署的 HTML 内容。',
        detail: readError || undefined,
        requestId,
      });
    }

    const shouldDownload = request.nextUrl.searchParams.get('download') === '1';
    if (shouldDownload) {
      const downloadFilename = selectedVersion?.filename || deployment.filename || `${code}.html`;
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Cache-Control': NO_STORE_CACHE_CONTROL,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        requestId,
        id: deployment.id,
        code: deployment.code,
        status: deployment.status,
        title: resolvedVersion?.title || deployment.title,
        description: resolvedVersion ? resolvedVersion.description : deployment.description,
        filename: resolvedVersion?.filename || deployment.filename,
        url: `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${deployment.code}`,
        filePath: resolvedVersion?.file_path || deployment.file_path,
        fileSize: resolvedVersion?.file_size ?? deployment.file_size,
        currentVersionId: deployment.current_version_id ?? null,
        versionId: resolvedVersion?.id ?? deployment.current_version_id ?? null,
        versionNumber: resolvedVersion?.version_number ?? null,
        versionUrl: resolvedVersion
          ? `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${deployment.code}/v/${resolvedVersion.version_number}`
          : null,
        versionLikeCount: resolvedVersion?.like_count ?? 0,
        likeCount: deployment.like_count ?? 0,
        locked: Number(deployment.like_count ?? 0) > 0,
        content,
        createdAt: resolvedVersion?.created_at || deployment.created_at,
        updatedAt: deployment.updated_at,
      },
      withNoStoreHeaders()
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '读取部署内容失败。',
      detail: getErrorMessage(error),
      requestId,
    });
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonError({
        status: 415,
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: '仅支持 application/json 请求。',
        detail: `当前 Content-Type 为 ${contentType || 'unknown'}`,
        requestId,
      });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError({
        status: 400,
        code: 'INVALID_PAYLOAD',
        message: '请求体必须是单个 JSON 对象。',
        requestId,
      });
    }

    const code = resolveCodeFromInput({ code: body.code, url: body.url });
    if (!code || !SHORT_CODE_PATTERN.test(code)) {
      return jsonError({
        status: 400,
        code: 'INVALID_CODE_OR_URL',
        message: '请提供有效的 code 或部署 url。',
        detail: '示例: {"code":"abc123","content":"<!doctype html>..."}',
        requestId,
      });
    }

    if (typeof body.content !== 'string' || !body.content.trim()) {
      return jsonError({
        status: 400,
        code: 'INVALID_CONTENT',
        message: 'content 必须是非空字符串。',
        requestId,
      });
    }

    const requiredDescription = normalizeDescription(body.description);
    if (!requiredDescription) {
      return jsonError({
        status: 400,
        code: 'DESCRIPTION_REQUIRED',
        message: '项目介绍不能为空。',
        detail: '追加 HTML 版本时必须提供 description，哪怕只有一句话。',
        hint: '示例: {"description":"这个版本更新了页面布局与交互。"}',
        requestId,
      });
    }

    const normalizedContent = body.content.trim();
    const fileSize = Buffer.byteLength(normalizedContent, 'utf8');

    if (fileSize > MAX_HTML_SIZE_BYTES) {
      return jsonError({
        status: 413,
        code: 'FILE_TOO_LARGE',
        message: 'HTML 文件体积超出限制。',
        detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
        requestId,
      });
    }

    if (!isValidHtmlContent(normalizedContent)) {
      return jsonError({
        status: 400,
        code: 'INVALID_HTML',
        message: '提交内容不是有效的 HTML 文本。',
        detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
        requestId,
      });
    }

    const { data: deployment, error } = await fetchDeploymentByCode(code);
    if (error || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: error?.message,
        requestId,
      });
    }

    const versionNumber = await getNextVersionNumber(deployment.id);
    const storagePath = createVersionedHtmlPath(code, versionNumber);
    const bucket = supabase.storage.from('deployments');
    const { error: uploadFileError } = await bucket.upload(storagePath, normalizedContent, {
      contentType: 'text/html',
      upsert: true,
    });

    if (uploadFileError) {
      return jsonError({
        status: 500,
        code: 'HTML_VERSION_UPLOAD_FAILED',
        message: 'HTML 新版本上传失败。',
        detail: uploadFileError.message,
        requestId,
      });
    }

    const {
      data: { publicUrl },
    } = bucket.getPublicUrl(storagePath);

    const nextTitle = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : deployment.title;
    const nextDescription = requiredDescription;
    let nextFilename = deployment.filename;

    if (typeof body.filename === 'string' && body.filename.trim()) {
      const normalizedFilename = body.filename.trim();
      if (!/\.html?$/i.test(normalizedFilename)) {
        return jsonError({
          status: 400,
          code: 'INVALID_FILENAME',
          message: 'filename 必须以 .html 或 .htm 结尾。',
          requestId,
        });
      }
      nextFilename = normalizedFilename;
    }

    const { data: version, error: versionError } = await supabase
      .from('deployment_versions')
      .insert({
        deployment_id: deployment.id,
        version_number: versionNumber,
        title: nextTitle,
        description: nextDescription,
        filename: nextFilename,
        file_path: publicUrl,
        file_size: fileSize,
      })
      .select()
      .single();

    if (versionError || !version) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSION_INSERT_FAILED',
        message: 'HTML 版本记录写入失败。',
        detail: versionError?.message,
        requestId,
      });
    }

    const updatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        current_version_id: version.id,
        title: nextTitle,
        description: nextDescription,
        filename: nextFilename,
        file_path: publicUrl,
        file_size: fileSize,
        updated_at: updatedAt,
      })
      .eq('id', deployment.id);

    if (updateError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_UPDATE_FAILED',
        message: '部署记录更新失败。',
        detail: updateError.message,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        requestId,
        id: deployment.id,
        code,
        versionId: version.id,
        versionNumber,
        updatedAt,
        fileSize,
        message: 'HTML 新版本已创建。',
        url: `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${code}`,
        detailUrl: `${request.nextUrl.protocol}//${request.nextUrl.host}/deploy/${deployment.id}`,
        versionUrl: `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${code}/v/${versionNumber}`,
        currentVersionId: version.id,
        preserveHint: `请打开 ${request.nextUrl.protocol}//${request.nextUrl.host}/deploy/${deployment.id} 或 ${request.nextUrl.protocol}//${request.nextUrl.host}/s/${code}，在 htmlcode.fun 网页内手动点赞；被点赞的版本会永久保留，主域名会自动指向最高赞版本。`,
      },
      withNoStoreHeaders()
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '更新部署内容失败。',
      detail: getErrorMessage(error),
      requestId,
    });
  }
}
