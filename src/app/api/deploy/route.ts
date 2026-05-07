import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import QRCode from 'qrcode';
import { randomBytes, randomUUID } from 'crypto';
import { MAX_HTML_SIZE_BYTES, SHORT_CODE_PATTERN, isValidHtmlContent, normalizeDescription } from '@/lib/deploy-config';
import { getErrorMessage } from '@/lib/error';
import { jsonError } from '@/lib/api-response';
import { createVersionedHtmlPath } from '@/lib/storage';

const COOLDOWN_SECONDS = 10;

type DeployFailOptions = {
  status: number;
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  docs?: string;
  stage?: 'validation' | 'rate_limit' | 'code_generation' | 'upload_html' | 'upload_qr' | 'database' | 'internal';
  retryAfterSeconds?: number;
  requestId: string;
};

function failResponse(options: DeployFailOptions) {
  return jsonError({
    status: options.status,
    code: options.code,
    message: options.message,
    detail: options.detail,
    hint: options.hint,
    docs: options.docs,
    stage: options.stage,
    requestId: options.requestId,
    retryAfterSeconds: options.retryAfterSeconds,
  });
}

function getRetryAfterSeconds(lastSuccessAt: string | null) {
  if (!lastSuccessAt) return 0;

  const lastSuccessMs = new Date(lastSuccessAt).getTime();
  const remainingMs = lastSuccessMs + COOLDOWN_SECONDS * 1000 - Date.now();
  if (remainingMs <= 0) return 0;

  return Math.ceil(remainingMs / 1000);
}

function createRandomCode() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function isCodeTaken(code: string) {
  const { data, error } = await supabase
    .from('deployments')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return !!data;
}

async function fetchDeploymentByCode(code: string) {
  return supabase
    .from('deployments')
    .select('*')
    .eq('code', code)
    .maybeSingle();
}

async function getNextVersionNumber(deploymentId: string) {
  const { data, error } = await supabase
    .from('deployment_versions')
    .select('version_number')
    .eq('deployment_id', deploymentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.version_number ?? 0) + 1;
}

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const candidate = createRandomCode();
    const exists = await isCodeTaken(candidate);
    if (!exists) return candidate;
  }

  throw new Error('Failed to generate unique code after retries');
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return failResponse({
        status: 415,
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: '当前接口不支持 multipart/form-data 上传。',
        detail: '检测到 -F file 方式。请改用 application/json 并传 content + filename。',
        hint: '示例: {"filename":"index.html","content":"<!doctype html>..."}',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    if (!contentType.includes('application/json')) {
      return failResponse({
        status: 415,
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: '仅支持 application/json 请求。',
        detail: `当前 Content-Type 为 ${contentType || 'unknown'}`,
        hint: '请设置 Content-Type: application/json，并在 body 中传 content 与 filename。',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError: unknown) {
      return failResponse({
        status: 400,
        code: 'INVALID_JSON',
        message: '请求体不是合法 JSON。',
        detail: getErrorMessage(parseError),
        hint: '不要使用 -F file 或原始文本，请传 JSON 对象。',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return failResponse({
        status: 400,
        code: 'BATCH_NOT_SUPPORTED',
        message: '仅支持单个 HTML 请求，不支持批量部署。',
        detail: 'Request body 必须是单个 JSON 对象，不能是数组。',
        hint: '请将单个 HTML 内容放在 content 字段。',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    const { content, filename, title, description, enableCustomCode, customCode, createVersion } = body as {
      content?: unknown;
      filename?: unknown;
      title?: unknown;
      description?: unknown;
      enableCustomCode?: unknown;
      customCode?: unknown;
      createVersion?: unknown;
    };

    if (typeof content !== 'string' || typeof filename !== 'string') {
      return failResponse({
        status: 400,
        code: 'INVALID_PAYLOAD',
        message: '请求参数无效。',
        detail: 'content 和 filename 必须为字符串。',
        hint: '示例字段: filename="index.html", content="<!doctype html>..."',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    const normalizedFilename = filename.trim();
    const normalizedContent = content.trim();

    if (!normalizedContent || !normalizedFilename) {
      return failResponse({
        status: 400,
        code: 'INVALID_PAYLOAD',
        message: '内容和文件名不能为空。',
        detail: '请提供有效的 HTML 内容与文件名。',
        stage: 'validation',
        requestId,
      });
    }

    if (!/\.html?$/i.test(normalizedFilename)) {
      return failResponse({
        status: 400,
        code: 'INVALID_FILENAME',
        message: '仅支持 .html 或 .htm 文件部署。',
        detail: '请将 filename 设置为 html/htm 后缀。',
        stage: 'validation',
        requestId,
      });
    }

    const fileSize = Buffer.byteLength(normalizedContent, 'utf8');
    if (fileSize > MAX_HTML_SIZE_BYTES) {
      return failResponse({
        status: 413,
        code: 'FILE_TOO_LARGE',
        message: 'HTML 文件体积超出限制。',
        detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
        stage: 'validation',
        requestId,
      });
    }

    if (!isValidHtmlContent(normalizedContent)) {
      return failResponse({
        status: 400,
        code: 'INVALID_HTML',
        message: '提交内容不是有效的 HTML 文本。',
        detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
        stage: 'validation',
        requestId,
      });
    }

    const customCodeEnabled = enableCustomCode === true;
    const shouldCreateVersion = createVersion === true;
    let resolvedCode: string;
    let existingDeployment: Record<string, unknown> | null = null;

    if (customCodeEnabled) {
      if (typeof customCode !== 'string' || !customCode.trim()) {
        return failResponse({
          status: 400,
          code: 'CUSTOM_CODE_REQUIRED',
          message: '已开启自定义短链，但未提供 customCode。',
          detail: '请传入 customCode，格式如 my-site-01。',
          hint: '若不需要自定义短链，请将 enableCustomCode 设为 false 或省略。',
          docs: '/api-docs',
          stage: 'validation',
          requestId,
        });
      }

      const normalizedCustomCode = customCode.trim().toLowerCase();
      if (!SHORT_CODE_PATTERN.test(normalizedCustomCode)) {
        return failResponse({
          status: 400,
          code: 'INVALID_CUSTOM_CODE',
          message: '自定义短链后缀格式不合法。',
          detail: '仅允许小写字母、数字、短横线，长度 4-32，且不能以短横线开头或结尾。',
          docs: '/api-docs',
          stage: 'validation',
          requestId,
        });
      }

      try {
        const { data: foundDeployment, error: findError } = await fetchDeploymentByCode(normalizedCustomCode);
        if (findError) {
          throw new Error(findError.message);
        }

        if (foundDeployment && !shouldCreateVersion) {
          return failResponse({
            status: 409,
            code: 'CUSTOM_CODE_TAKEN',
            message: '该自定义短链后缀已被占用。',
            detail: `customCode=${normalizedCustomCode}`,
            hint: '请更换一个未占用的 customCode，或传 createVersion: true 在该短链下创建新版本。',
            docs: '/api-docs',
            stage: 'code_generation',
            requestId,
          });
        }

        if (foundDeployment) {
          existingDeployment = foundDeployment;
        }
      } catch (queryError: unknown) {
        return failResponse({
          status: 500,
          code: 'CUSTOM_CODE_CHECK_FAILED',
          message: '自定义短链可用性检查失败。',
          detail: getErrorMessage(queryError),
          stage: 'code_generation',
          requestId,
        });
      }

      resolvedCode = normalizedCustomCode;
    } else {
      try {
        resolvedCode = await generateUniqueCode();
      } catch (generateError: unknown) {
        return failResponse({
          status: 500,
          code: 'AUTO_CODE_GENERATION_FAILED',
          message: '自动生成短链后缀失败，请稍后再试。',
          detail: getErrorMessage(generateError),
          stage: 'code_generation',
          requestId,
        });
      }
    }

    // Global cooldown check (shared across all callers)
    const { data: stateRow, error: stateQueryError } = await supabase
      .from('deploy_api_state')
      .select('last_success_at')
      .eq('id', 1)
      .maybeSingle();

    if (stateQueryError) {
      return failResponse({
        status: 500,
        code: 'COOLDOWN_STATE_QUERY_FAILED',
        message: '部署状态读取失败，请稍后再试。',
        detail: stateQueryError.message,
        stage: 'rate_limit',
        requestId,
      });
    }

    if (!stateRow) {
      const { error: stateInitError } = await supabase
        .from('deploy_api_state')
        .insert({ id: 1, last_success_at: null });

      if (stateInitError) {
        return failResponse({
          status: 500,
          code: 'COOLDOWN_STATE_INIT_FAILED',
          message: '部署状态初始化失败，请稍后重试。',
          detail: stateInitError.message,
          stage: 'rate_limit',
          requestId,
        });
      }
    }

    const retryAfterSeconds = getRetryAfterSeconds(stateRow?.last_success_at ?? null);
    if (retryAfterSeconds > 0) {
      return failResponse({
        status: 429,
        code: 'COOLDOWN_ACTIVE',
        message: '当前处于部署冷却期，请稍后再试。',
        detail: `部署成功后需等待 ${COOLDOWN_SECONDS} 秒。`,
        stage: 'rate_limit',
        retryAfterSeconds,
        requestId,
      });
    }

    // Use resolved short code
    const code = resolvedCode;
    
    // Determine protocol and host for the deployment URL
    const host = request.headers.get('host') || 'localhost:3000';
    const forwardedProto = request.headers.get('x-forwarded-proto');
    let protocol = forwardedProto ? forwardedProto.split(',')[0] : 'http';
    
    if (!forwardedProto) {
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        protocol = 'http';
      } else {
        protocol = 'https';
      }
    }

    const deployUrl = `${protocol}://${host}/s/${code}`;

    const versionNumber = existingDeployment
      ? await getNextVersionNumber(String(existingDeployment.id))
      : 1;

    // 1. Upload HTML to Supabase Storage
    const htmlPath = createVersionedHtmlPath(code, versionNumber);
    const { error: uploadHtmlError } = await supabase.storage
      .from('deployments')
      .upload(htmlPath, normalizedContent, {
        contentType: 'text/html',
        upsert: true
      });

    if (uploadHtmlError) {
      return failResponse({
        status: 500,
        code: 'DEPLOY_UPLOAD_HTML_FAILED',
        message: 'HTML 上传失败。',
        detail: uploadHtmlError.message,
        stage: 'upload_html',
        requestId,
      });
    }

    const qrPath = `qrcodes/${code}.png`;
    let qrPublicUrl = typeof existingDeployment?.qr_code_path === 'string'
      ? existingDeployment.qr_code_path
      : '';

    if (!existingDeployment) {
      // 2. Generate and Upload QR Code
      const qrBuffer = await QRCode.toBuffer(deployUrl);
      const { error: uploadQrError } = await supabase.storage
        .from('deployments')
        .upload(qrPath, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadQrError) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_UPLOAD_QR_FAILED',
          message: '二维码生成或上传失败。',
          detail: uploadQrError.message,
          stage: 'upload_qr',
          requestId,
        });
      }

      const { data: { publicUrl } } = supabase.storage.from('deployments').getPublicUrl(qrPath);
      qrPublicUrl = publicUrl;
    }

    // Get Public URLs
    const { data: { publicUrl: htmlPublicUrl } } = supabase.storage.from('deployments').getPublicUrl(htmlPath);
    const versionTitle = typeof title === 'string' && title.trim() ? title.trim() : normalizedFilename;
    const versionDescription = normalizeDescription(description);

    let deploymentId: string;
    let versionId: string | null = null;

    if (existingDeployment) {
      deploymentId = String(existingDeployment.id);
      const { data: version, error: versionError } = await supabase
        .from('deployment_versions')
        .insert({
          deployment_id: deploymentId,
          version_number: versionNumber,
          title: versionTitle,
          description: versionDescription,
          filename: normalizedFilename,
          file_path: htmlPublicUrl,
          file_size: fileSize,
        })
        .select()
        .single();

      if (versionError || !version) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_VERSION_INSERT_FAILED',
          message: '新版本记录写入失败。',
          detail: versionError?.message,
          stage: 'database',
          requestId,
        });
      }

      versionId = version.id;
      const { error: updateError } = await supabase
        .from('deployments')
        .update({
          current_version_id: version.id,
          title: versionTitle,
          description: versionDescription,
          filename: normalizedFilename,
          file_path: htmlPublicUrl,
          file_size: fileSize,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deploymentId);

      if (updateError) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_CURRENT_VERSION_UPDATE_FAILED',
          message: '当前版本指针更新失败。',
          detail: updateError.message,
          stage: 'database',
          requestId,
        });
      }
    } else {
      // 3. Save to Supabase DB
      const { data, error: dbError } = await supabase
        .from('deployments')
        .insert({
        code,
        title: versionTitle,
        description: versionDescription,
        filename: normalizedFilename,
        file_path: htmlPublicUrl, // Storing the public URL for easy access
        file_size: fileSize,
        qr_code_path: qrPublicUrl,
        status: 'active'
        })
        .select()
        .single();

      if (dbError || !data) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_DB_INSERT_FAILED',
          message: '部署记录写入失败。',
          detail: dbError?.message,
          stage: 'database',
          requestId,
        });
      }

      deploymentId = data.id;
      const { data: version, error: versionError } = await supabase
        .from('deployment_versions')
        .insert({
          deployment_id: deploymentId,
          version_number: versionNumber,
          title: versionTitle,
          description: versionDescription,
          filename: normalizedFilename,
          file_path: htmlPublicUrl,
          file_size: fileSize,
          created_at: data.created_at,
        })
        .select()
        .single();

      if (versionError || !version) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_VERSION_INSERT_FAILED',
          message: '初始版本记录写入失败。',
          detail: versionError?.message,
          stage: 'database',
          requestId,
        });
      }

      versionId = version.id;
      const { error: currentVersionError } = await supabase
        .from('deployments')
        .update({ current_version_id: version.id })
        .eq('id', deploymentId);

      if (currentVersionError) {
        return failResponse({
          status: 500,
          code: 'DEPLOY_CURRENT_VERSION_UPDATE_FAILED',
          message: '当前版本指针写入失败。',
          detail: currentVersionError.message,
          stage: 'database',
          requestId,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const { error: cooldownUpdateError } = await supabase
      .from('deploy_api_state')
      .update({ last_success_at: nowIso })
      .eq('id', 1);

    if (cooldownUpdateError) {
      return failResponse({
        status: 500,
        code: 'COOLDOWN_STATE_UPDATE_FAILED',
        message: '部署已成功但冷却状态更新失败。',
        detail: cooldownUpdateError.message,
        stage: 'rate_limit',
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      id: deploymentId,
      code,
      url: deployUrl,
      qrCode: qrPublicUrl,
      description: versionDescription,
      versionId,
      versionNumber,
      createdVersion: Boolean(existingDeployment),
      requestId,
      cooldownSeconds: COOLDOWN_SECONDS,
      nextAvailableAt: new Date(Date.now() + COOLDOWN_SECONDS * 1000).toISOString(),
      customCodeEnabled,
    });

  } catch (error: unknown) {
    console.error('Deployment error:', error);
    return failResponse({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '部署过程中发生未预期错误。',
      detail: getErrorMessage(error),
      stage: 'internal',
      requestId,
    });
  }
}
