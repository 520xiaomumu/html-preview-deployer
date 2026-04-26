import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { randomUUID } from 'crypto';
import {
  MAX_HTML_SIZE_BYTES,
  SHORT_CODE_PATTERN,
  NO_STORE_CACHE_CONTROL,
  isValidHtmlContent,
  resolveCodeFromInput,
} from '@/lib/deploy-config';
import { createVersionedHtmlPath, getStoragePathFromFilePath } from '@/lib/storage';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

async function fetchDeploymentByCode(code: string) {
  return supabase
    .from('deployments')
    .select('*')
    .eq('code', code)
    .maybeSingle();
}

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

    const storagePath = resolveStoragePath(deployment, code);
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
      const downloadFilename = deployment.filename || `${code}.html`;
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
        title: deployment.title,
        filename: deployment.filename,
        url: `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${deployment.code}`,
        filePath: deployment.file_path,
        fileSize: deployment.file_size,
        likeCount: deployment.like_count ?? 0,
        locked: Number(deployment.like_count ?? 0) > 0,
        content,
        createdAt: deployment.created_at,
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

    if (Number(deployment.like_count ?? 0) > 0) {
      return jsonError({
        status: 423,
        code: 'DEPLOYMENT_LOCKED_BY_LIKE',
        message: '该项目已被手动点赞，内容已锁定，不能再修改。',
        detail: `当前点赞数: ${deployment.like_count}`,
        requestId,
      });
    }

    const storagePath = createVersionedHtmlPath(code);
    const bucket = supabase.storage.from('deployments');
    const { error: updateFileError } = await bucket.update(storagePath, normalizedContent, {
      contentType: 'text/html',
      upsert: true,
    });

    if (updateFileError) {
      const { error: uploadFallbackError } = await bucket.upload(storagePath, normalizedContent, {
        contentType: 'text/html',
        upsert: true,
      });

      if (uploadFallbackError) {
        return jsonError({
          status: 500,
          code: 'HTML_UPDATE_FAILED',
          message: 'HTML 内容更新失败。',
          detail: `${updateFileError.message}; fallback: ${uploadFallbackError.message}`,
          requestId,
        });
      }
    }

    const updates: {
      file_size: number;
      updated_at: string;
      title?: string;
      filename?: string;
      file_path?: string;
    } = {
      file_size: fileSize,
      updated_at: new Date().toISOString(),
    };

    const {
      data: { publicUrl },
    } = supabase.storage.from('deployments').getPublicUrl(storagePath);
    updates.file_path = publicUrl;

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }

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
      updates.filename = normalizedFilename;
    }

    const { error: updateError } = await supabase
      .from('deployments')
      .update(updates)
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
        updatedAt: updates.updated_at,
        fileSize,
        message: 'HTML 内容已更新。',
        url: `${request.nextUrl.protocol}//${request.nextUrl.host}/s/${code}`,
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
