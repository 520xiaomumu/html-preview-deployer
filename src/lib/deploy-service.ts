import {
  MAX_HTML_SIZE_BYTES,
  NO_STORE_CACHE_CONTROL,
  SHORT_CODE_PATTERN,
  isValidHtmlContent,
  normalizeDescription,
  resolveCodeFromInput,
} from './deploy-config.ts';
import { getErrorMessage } from './error.ts';

// Structural on purpose: this file is also bundled by the Supabase edge function,
// which should not resolve the @supabase/supabase-js npm package. The loose return
// type keeps the real client assignable without copying its generated generics.
type SupabaseClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  storage: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from(bucket: string): any;
  };
};

const COOLDOWN_SECONDS = 10;
const AGENT_GUIDE_URL = 'https://www.htmlcode.fun/s/htmlcode-fun-guide';

export type ServiceResult = {
  status: number;
  json?: Record<string, unknown>;
  text?: string;
  headers: Record<string, string>;
};

type FailOptions = {
  status: number;
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  docs?: string;
  stage?: string;
  requestId?: string;
  retryAfterSeconds?: number;
};

type VersionRow = {
  id: string;
  deployment_id?: string;
  version_number: number;
  title: string | null;
  description: string | null;
  filename: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  updated_at?: string | null;
  like_count: number | null;
  status?: 'active' | 'inactive' | null;
};

type DeploymentRow = {
  id: string;
  code: string;
  current_version_id: string | null;
  primary_version_strategy?: 'likes' | 'latest' | null;
  title: string | null;
  description: string | null;
  filename: string | null;
  file_path: string | null;
  file_size: number | null;
  qr_code_path?: string | null;
  like_count?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function noStoreHeaders(extra?: Record<string, string>) {
  return {
    'cache-control': NO_STORE_CACHE_CONTROL,
    ...(extra || {}),
  };
}

function fail(options: FailOptions): ServiceResult {
  const headers = noStoreHeaders(
    typeof options.retryAfterSeconds === 'number'
      ? { 'retry-after': String(options.retryAfterSeconds) }
      : undefined,
  );
  return {
    status: options.status,
    headers,
    json: {
      success: false,
      error: options.message,
      errorCode: options.code,
      detail: options.detail,
      hint: options.hint,
      docs: options.docs,
      stage: options.stage,
      requestId: options.requestId,
      retryAfterSeconds: options.retryAfterSeconds,
    },
  };
}

function ok(json: Record<string, unknown>, headers = noStoreHeaders()): ServiceResult {
  return { status: 200, json, headers };
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function createVersionedHtmlPath(code: string, versionNumber: number, now = Date.now()) {
  return `html/${code}/v${versionNumber}-${now}.html`;
}

function getStoragePathFromFilePath(filePath: unknown, fallbackCode: string) {
  const fallback = `html/${fallbackCode}.html`;
  if (typeof filePath !== 'string' || !filePath.trim()) return fallback;
  try {
    const parsed = new URL(filePath);
    const marker = '/deployments/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return fallback;
    return parsed.pathname.slice(index + marker.length) || fallback;
  } catch {
    return fallback;
  }
}

function parseJsonBody(rawBody: string, requestId: string): { body: Record<string, unknown> | null; error: ServiceResult | null } {
  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch (parseError: unknown) {
    return {
      body: null,
      error: fail({
        status: 400,
        code: 'INVALID_JSON',
        message: '请求体不是合法 JSON。',
        detail: getErrorMessage(parseError),
        hint: '不要使用 -F file 或原始文本，请传 JSON 对象。',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      }),
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      body: null,
      error: fail({
        status: 400,
        code: 'INVALID_PAYLOAD',
        message: '请求体必须是单个 JSON 对象。',
        detail: 'Request body 必须是单个 JSON 对象，不能是数组。',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      }),
    };
  }

  return { body: parsed as Record<string, unknown>, error: null };
}

function createRandomCode() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function isCodeTaken(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase
    .from('deployments')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function generateUniqueCode(supabase: SupabaseClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createRandomCode();
    if (!(await isCodeTaken(supabase, candidate))) return candidate;
  }
  throw new Error('Failed to generate unique code after retries');
}

function getRetryAfterSeconds(lastSuccessAt: string | null) {
  if (!lastSuccessAt) return 0;
  const remainingMs = new Date(lastSuccessAt).getTime() + COOLDOWN_SECONDS * 1000 - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

async function fetchDeploymentByCode(supabase: SupabaseClient, code: string) {
  return supabase.from('deployments').select('*').eq('code', code).maybeSingle();
}

async function getNextVersionNumber(supabase: SupabaseClient, deploymentId: string) {
  const { data, error } = await supabase
    .from('deployment_versions')
    .select('version_number')
    .eq('deployment_id', deploymentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.version_number ?? 0) + 1;
}

async function fetchVersions(supabase: SupabaseClient, deploymentId: string) {
  const { data, error } = await supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deploymentId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as VersionRow[];
}

function selectPrimaryVersion(
  versions: VersionRow[],
  currentVersionId?: string | null,
  strategy: 'likes' | 'latest' = 'likes',
) {
  const activeVersions = versions
    .filter((version) => (version.status || 'active') === 'active')
    .sort((a, b) => Number(b.version_number ?? 0) - Number(a.version_number ?? 0));

  if (strategy === 'latest') return activeVersions[0] || null;

  const likedVersions = activeVersions
    .filter((version) => Number(version.like_count ?? 0) > 0)
    .sort((a, b) => {
      const likeDiff = Number(b.like_count ?? 0) - Number(a.like_count ?? 0);
      return likeDiff || Number(b.version_number ?? 0) - Number(a.version_number ?? 0);
    });

  return likedVersions[0]
    || activeVersions.find((version) => version.id === currentVersionId)
    || activeVersions[0]
    || null;
}

function pageLinks(publicOrigin: string, code: string, deploymentId: string, versionNumber: number | null) {
  const origin = publicOrigin.replace(/\/$/, '');
  return {
    url: `${origin}/s/${code}`,
    detailUrl: `${origin}/deploy/${deploymentId}`,
    versionUrl: versionNumber ? `${origin}/s/${code}/v/${versionNumber}` : null,
  };
}

export async function postDeploy(options: {
  supabase: SupabaseClient;
  contentType: string;
  rawBody: string;
  publicOrigin: string;
  createQrPng: (url: string) => Promise<Uint8Array>;
}): Promise<ServiceResult> {
  const requestId = crypto.randomUUID();
  const { supabase, publicOrigin } = options;

  try {
    const contentType = options.contentType || '';
    if (contentType.includes('multipart/form-data')) {
      return fail({
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
      return fail({
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

    const parsed = parseJsonBody(options.rawBody, requestId);
    if (parsed.error || !parsed.body) {
      if (parsed.error?.json?.errorCode === 'INVALID_PAYLOAD') {
        return fail({
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
      return parsed.error || fail({ status: 400, code: 'INVALID_JSON', message: '请求体不是合法 JSON。', requestId });
    }

    const body = parsed.body;
    const { content, filename, title, description, enableCustomCode, customCode, createVersion } = body;
    if (typeof content !== 'string' || typeof filename !== 'string') {
      return fail({
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
      return fail({
        status: 400,
        code: 'INVALID_PAYLOAD',
        message: '内容和文件名不能为空。',
        detail: '请提供有效的 HTML 内容与文件名。',
        stage: 'validation',
        requestId,
      });
    }
    if (!/\.html?$/i.test(normalizedFilename)) {
      return fail({
        status: 400,
        code: 'INVALID_FILENAME',
        message: '仅支持 .html 或 .htm 文件部署。',
        detail: '请将 filename 设置为 html/htm 后缀。',
        stage: 'validation',
        requestId,
      });
    }

    const fileSize = byteLength(normalizedContent);
    if (fileSize > MAX_HTML_SIZE_BYTES) {
      return fail({
        status: 413,
        code: 'FILE_TOO_LARGE',
        message: 'HTML 文件体积超出限制。',
        detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
        stage: 'validation',
        requestId,
      });
    }
    if (!isValidHtmlContent(normalizedContent)) {
      return fail({
        status: 400,
        code: 'INVALID_HTML',
        message: '提交内容不是有效的 HTML 文本。',
        detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
        stage: 'validation',
        requestId,
      });
    }

    const versionDescription = normalizeDescription(description);
    if (!versionDescription) {
      return fail({
        status: 400,
        code: 'DESCRIPTION_REQUIRED',
        message: '项目介绍不能为空。',
        detail: 'Agent 上传项目时必须提供 description，哪怕只有一句话。',
        hint: '示例: "description": "一个用于展示今日 AI 新闻摘要的单页应用。"',
        docs: '/api-docs',
        stage: 'validation',
        requestId,
      });
    }

    const customCodeEnabled = enableCustomCode === true;
    const shouldCreateVersion = createVersion === true;
    let resolvedCode: string;
    let existingDeployment: DeploymentRow | null = null;

    if (customCodeEnabled) {
      if (typeof customCode !== 'string' || !customCode.trim()) {
        return fail({
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
        return fail({
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
        const { data: foundDeployment, error: findError } = await fetchDeploymentByCode(supabase, normalizedCustomCode);
        if (findError) throw new Error(findError.message);
        if (foundDeployment && !shouldCreateVersion) {
          return fail({
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
        if (foundDeployment) existingDeployment = foundDeployment as DeploymentRow;
      } catch (queryError: unknown) {
        return fail({
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
        resolvedCode = await generateUniqueCode(supabase);
      } catch (generateError: unknown) {
        return fail({
          status: 500,
          code: 'AUTO_CODE_GENERATION_FAILED',
          message: '自动生成短链后缀失败，请稍后再试。',
          detail: getErrorMessage(generateError),
          stage: 'code_generation',
          requestId,
        });
      }
    }

    const { data: stateRow, error: stateQueryError } = await supabase
      .from('deploy_api_state')
      .select('last_success_at')
      .eq('id', 1)
      .maybeSingle();
    if (stateQueryError) {
      return fail({
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
        return fail({
          status: 500,
          code: 'COOLDOWN_STATE_INIT_FAILED',
          message: '部署状态初始化失败，请稍后重试。',
          detail: stateInitError.message,
          stage: 'rate_limit',
          requestId,
        });
      }
    }

    const retryAfterSeconds = getRetryAfterSeconds(
      (stateRow as { last_success_at?: string | null } | null)?.last_success_at ?? null,
    );
    if (retryAfterSeconds > 0) {
      return fail({
        status: 429,
        code: 'COOLDOWN_ACTIVE',
        message: '当前处于部署冷却期，请稍后再试。',
        detail: `部署成功后需等待 ${COOLDOWN_SECONDS} 秒。`,
        stage: 'rate_limit',
        retryAfterSeconds,
        requestId,
      });
    }

    const code = resolvedCode;
    const linksForCode = (deploymentId: string, versionNumber: number) => pageLinks(publicOrigin, code, deploymentId, versionNumber);
    const versionNumber = existingDeployment
      ? await getNextVersionNumber(supabase, existingDeployment.id)
      : 1;
    const htmlPath = createVersionedHtmlPath(code, versionNumber);
    const { error: uploadHtmlError } = await supabase.storage
      .from('deployments')
      .upload(htmlPath, normalizedContent, {
        contentType: 'text/html',
        cacheControl: '31536000',
        upsert: true,
      });
    if (uploadHtmlError) {
      return fail({
        status: 500,
        code: 'DEPLOY_UPLOAD_HTML_FAILED',
        message: 'HTML 上传失败。',
        detail: uploadHtmlError.message,
        stage: 'upload_html',
        requestId,
      });
    }

    let qrPublicUrl = typeof existingDeployment?.qr_code_path === 'string' ? existingDeployment.qr_code_path : '';
    const deployUrl = pageLinks(publicOrigin, code, 'pending', null).url;
    if (!existingDeployment) {
      try {
        const qrBytes = await options.createQrPng(deployUrl);
        const qrPath = `qrcodes/${code}.png`;
        const { error: uploadQrError } = await supabase.storage
          .from('deployments')
          .upload(qrPath, qrBytes, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: true,
          });
        if (uploadQrError) {
          return fail({
            status: 500,
            code: 'DEPLOY_UPLOAD_QR_FAILED',
            message: '二维码生成或上传失败。',
            detail: uploadQrError.message,
            stage: 'upload_qr',
            requestId,
          });
        }
        qrPublicUrl = supabase.storage.from('deployments').getPublicUrl(qrPath).data.publicUrl;
      } catch (qrError: unknown) {
        return fail({
          status: 500,
          code: 'DEPLOY_UPLOAD_QR_FAILED',
          message: '二维码生成或上传失败。',
          detail: getErrorMessage(qrError),
          stage: 'upload_qr',
          requestId,
        });
      }
    }

    const htmlPublicUrl = supabase.storage.from('deployments').getPublicUrl(htmlPath).data.publicUrl;
    const versionTitle = typeof title === 'string' && title.trim() ? title.trim() : normalizedFilename;
    let deploymentId: string;
    let versionId: string | null = null;

    if (existingDeployment) {
      deploymentId = existingDeployment.id;
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
        return fail({
          status: 500,
          code: 'DEPLOY_VERSION_INSERT_FAILED',
          message: '新版本记录写入失败。',
          detail: versionError?.message,
          stage: 'database',
          requestId,
        });
      }
      versionId = (version as { id: string }).id;
      const { error: updateError } = await supabase
        .from('deployments')
        .update({
          current_version_id: versionId,
          title: versionTitle,
          description: versionDescription,
          filename: normalizedFilename,
          file_path: htmlPublicUrl,
          file_size: fileSize,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deploymentId);
      if (updateError) {
        return fail({
          status: 500,
          code: 'DEPLOY_CURRENT_VERSION_UPDATE_FAILED',
          message: '当前版本指针更新失败。',
          detail: updateError.message,
          stage: 'database',
          requestId,
        });
      }
    } else {
      const { data, error: dbError } = await supabase
        .from('deployments')
        .insert({
          code,
          title: versionTitle,
          description: versionDescription,
          filename: normalizedFilename,
          file_path: htmlPublicUrl,
          file_size: fileSize,
          qr_code_path: qrPublicUrl,
          status: 'active',
        })
        .select()
        .single();
      if (dbError || !data) {
        return fail({
          status: 500,
          code: 'DEPLOY_DB_INSERT_FAILED',
          message: '部署记录写入失败。',
          detail: dbError?.message,
          stage: 'database',
          requestId,
        });
      }
      deploymentId = (data as { id: string; created_at?: string }).id;
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
          created_at: (data as { created_at?: string }).created_at,
        })
        .select()
        .single();
      if (versionError || !version) {
        return fail({
          status: 500,
          code: 'DEPLOY_VERSION_INSERT_FAILED',
          message: '初始版本记录写入失败。',
          detail: versionError?.message,
          stage: 'database',
          requestId,
        });
      }
      versionId = (version as { id: string }).id;
      const { error: currentVersionError } = await supabase
        .from('deployments')
        .update({ current_version_id: versionId })
        .eq('id', deploymentId);
      if (currentVersionError) {
        return fail({
          status: 500,
          code: 'DEPLOY_CURRENT_VERSION_UPDATE_FAILED',
          message: '当前版本指针写入失败。',
          detail: currentVersionError.message,
          stage: 'database',
          requestId,
        });
      }
    }

    const { error: cooldownUpdateError } = await supabase
      .from('deploy_api_state')
      .update({ last_success_at: new Date().toISOString() })
      .eq('id', 1);
    if (cooldownUpdateError) {
      return fail({
        status: 500,
        code: 'COOLDOWN_STATE_UPDATE_FAILED',
        message: '部署已成功但冷却状态更新失败。',
        detail: cooldownUpdateError.message,
        stage: 'rate_limit',
        requestId,
      });
    }

    const links = linksForCode(deploymentId, versionNumber);
    const isNewDeployment = !existingDeployment;
    const preserveHint = isNewDeployment
      ? `请打开 ${links.detailUrl} 或 ${links.url}，在 htmlcode.fun 网页内手动点赞；被点赞的版本会永久保留。后续更新请复用短链后缀 ${code}，传 enableCustomCode=true、customCode="${code}"、createVersion=true，即可在同一个主域名短链下持续迭代。`
      : undefined;

    return ok({
      success: true,
      id: deploymentId,
      code,
      url: links.url,
      detailUrl: links.detailUrl,
      versionUrl: links.versionUrl,
      qrCode: qrPublicUrl,
      description: versionDescription,
      versionId,
      versionNumber,
      currentVersionId: versionId,
      versionCount: versionNumber,
      primaryVersionStrategy: existingDeployment?.primary_version_strategy || 'likes',
      createdVersion: !isNewDeployment,
      ...(preserveHint ? { preserveHint } : {}),
      ...(isNewDeployment ? { agentGuideUrl: AGENT_GUIDE_URL } : {}),
      requestId,
      cooldownSeconds: COOLDOWN_SECONDS,
      nextAvailableAt: new Date(Date.now() + COOLDOWN_SECONDS * 1000).toISOString(),
      customCodeEnabled,
    });
  } catch (error: unknown) {
    console.error('Deployment error:', error);
    return fail({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '部署过程中发生未预期错误。',
      detail: getErrorMessage(error),
      stage: 'internal',
      requestId,
    });
  }
}

export async function getDeployContent(options: {
  supabase: SupabaseClient;
  publicOrigin: string;
  code: string | null;
  url: string | null;
  version: string | null;
  download: boolean;
}): Promise<ServiceResult> {
  const requestId = crypto.randomUUID();
  const code = resolveCodeFromInput({ code: options.code, url: options.url });
  if (!code || !SHORT_CODE_PATTERN.test(code)) {
    return fail({
      status: 400,
      code: 'INVALID_CODE_OR_URL',
      message: '请提供有效的 code 或部署 url。',
      detail: '示例: ?code=abc123 或 ?url=https://www.htmlcode.fun/s/abc123',
      requestId,
    });
  }

  const { data: deployment, error } = await fetchDeploymentByCode(options.supabase, code);
  if (error || !deployment) {
    return fail({
      status: 404,
      code: 'DEPLOYMENT_NOT_FOUND',
      message: '未找到对应部署。',
      detail: error?.message,
      requestId,
    });
  }
  const deploymentRow = deployment as DeploymentRow;

  let selectedVersion: VersionRow | null = null;
  if (options.version) {
    const versionNumber = Number(options.version);
    const query = options.supabase
      .from('deployment_versions')
      .select('*')
      .eq('deployment_id', deploymentRow.id);
    const { data, error: versionError } = await (Number.isInteger(versionNumber) && versionNumber > 0
      ? query.eq('version_number', versionNumber)
      : query.eq('id', options.version)
    ).maybeSingle();
    if (versionError || !data) {
      return fail({
        status: 404,
        code: 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: '未找到指定版本。',
        detail: versionError?.message,
        requestId,
      });
    }
    selectedVersion = data as VersionRow;
  }

  let resolvedVersion = selectedVersion;
  if (!resolvedVersion) {
    let versions: VersionRow[];
    try {
      versions = await fetchVersions(options.supabase, deploymentRow.id);
    } catch (versionsError: unknown) {
      return fail({
        status: 500,
        code: 'DEPLOYMENT_VERSIONS_FETCH_FAILED',
        message: '版本历史读取失败。',
        detail: getErrorMessage(versionsError),
        requestId,
      });
    }
    resolvedVersion = selectPrimaryVersion(
      versions,
      deploymentRow.current_version_id,
      deploymentRow.primary_version_strategy || 'likes',
    );
  }

  const storagePath = resolvedVersion
    ? getStoragePathFromFilePath(resolvedVersion.file_path, code)
    : getStoragePathFromFilePath(deploymentRow.file_path, code);
  const { data: fileData, error: downloadError } = await options.supabase.storage
    .from('deployments')
    .download(storagePath);
  if (downloadError || !fileData) {
    return fail({
      status: 404,
      code: 'HTML_CONTENT_NOT_FOUND',
      message: '未找到该部署的 HTML 内容。',
      detail: downloadError?.message,
      requestId,
    });
  }
  const content = await fileData.text();

  if (options.download) {
    const downloadFilename = selectedVersion?.filename || deploymentRow.filename || `${code}.html`;
    return {
      status: 200,
      text: content,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': `attachment; filename="${downloadFilename}"`,
        'cache-control': NO_STORE_CACHE_CONTROL,
        'x-content-type-options': 'nosniff',
      },
    };
  }

  const links = pageLinks(options.publicOrigin, deploymentRow.code, deploymentRow.id, resolvedVersion?.version_number ?? null);
  return ok({
    success: true,
    requestId,
    id: deploymentRow.id,
    code: deploymentRow.code,
    status: deploymentRow.status,
    title: resolvedVersion?.title || deploymentRow.title,
    description: resolvedVersion ? resolvedVersion.description : deploymentRow.description,
    filename: resolvedVersion?.filename || deploymentRow.filename,
    url: links.url,
    filePath: resolvedVersion?.file_path || deploymentRow.file_path,
    fileSize: resolvedVersion?.file_size ?? deploymentRow.file_size,
    currentVersionId: deploymentRow.current_version_id ?? null,
    primaryVersionStrategy: deploymentRow.primary_version_strategy || 'likes',
    versionId: resolvedVersion?.id ?? deploymentRow.current_version_id ?? null,
    versionNumber: resolvedVersion?.version_number ?? null,
    versionUrl: links.versionUrl,
    versionLikeCount: resolvedVersion?.like_count ?? 0,
    likeCount: deploymentRow.like_count ?? 0,
    locked: Number(deploymentRow.like_count ?? 0) > 0,
    content,
    createdAt: resolvedVersion?.created_at || deploymentRow.created_at,
    updatedAt: resolvedVersion?.updated_at || deploymentRow.updated_at,
  });
}

export async function patchDeployContent(options: {
  supabase: SupabaseClient;
  contentType: string;
  rawBody: string;
  publicOrigin: string;
}): Promise<ServiceResult> {
  const requestId = crypto.randomUUID();
  const contentType = options.contentType || '';
  if (!contentType.includes('application/json')) {
    return fail({
      status: 415,
      code: 'UNSUPPORTED_CONTENT_TYPE',
      message: '仅支持 application/json 请求。',
      detail: `当前 Content-Type 为 ${contentType || 'unknown'}`,
      requestId,
    });
  }

  const parsed = parseJsonBody(options.rawBody, requestId);
  if (parsed.error || !parsed.body) return parsed.error || fail({ status: 400, code: 'INVALID_JSON', message: '请求体不是合法 JSON。', requestId });
  const body = parsed.body;
  const code = resolveCodeFromInput({ code: body.code, url: body.url });
  if (!code || !SHORT_CODE_PATTERN.test(code)) {
    return fail({
      status: 400,
      code: 'INVALID_CODE_OR_URL',
      message: '请提供有效的 code 或部署 url。',
      detail: '示例: {"code":"abc123","content":"<!doctype html>..."}',
      requestId,
    });
  }
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return fail({ status: 400, code: 'INVALID_CONTENT', message: 'content 必须是非空字符串。', requestId });
  }
  const requiredDescription = normalizeDescription(body.description);
  if (!requiredDescription) {
    return fail({
      status: 400,
      code: 'DESCRIPTION_REQUIRED',
      message: '项目介绍不能为空。',
      detail: '追加 HTML 版本时必须提供 description，哪怕只有一句话。',
      hint: '示例: {"description":"这个版本更新了页面布局与交互。"}',
      requestId,
    });
  }

  const normalizedContent = body.content.trim();
  const fileSize = byteLength(normalizedContent);
  if (fileSize > MAX_HTML_SIZE_BYTES) {
    return fail({
      status: 413,
      code: 'FILE_TOO_LARGE',
      message: 'HTML 文件体积超出限制。',
      detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
      requestId,
    });
  }
  if (!isValidHtmlContent(normalizedContent)) {
    return fail({
      status: 400,
      code: 'INVALID_HTML',
      message: '提交内容不是有效的 HTML 文本。',
      detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
      requestId,
    });
  }

  const { data: deployment, error } = await fetchDeploymentByCode(options.supabase, code);
  if (error || !deployment) {
    return fail({
      status: 404,
      code: 'DEPLOYMENT_NOT_FOUND',
      message: '未找到对应部署。',
      detail: error?.message,
      requestId,
    });
  }
  const deploymentRow = deployment as DeploymentRow;
  const versionNumber = await getNextVersionNumber(options.supabase, deploymentRow.id);
  const storagePath = createVersionedHtmlPath(code, versionNumber);
  const bucket = options.supabase.storage.from('deployments');
  const { error: uploadFileError } = await bucket.upload(storagePath, normalizedContent, {
    contentType: 'text/html',
    upsert: true,
  });
  if (uploadFileError) {
    return fail({
      status: 500,
      code: 'HTML_VERSION_UPLOAD_FAILED',
      message: 'HTML 新版本上传失败。',
      detail: uploadFileError.message,
      requestId,
    });
  }

  const publicUrl = bucket.getPublicUrl(storagePath).data.publicUrl;
  const nextTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : deploymentRow.title;
  let nextFilename = deploymentRow.filename;
  if (typeof body.filename === 'string' && body.filename.trim()) {
    const normalizedFilename = body.filename.trim();
    if (!/\.html?$/i.test(normalizedFilename)) {
      return fail({ status: 400, code: 'INVALID_FILENAME', message: 'filename 必须以 .html 或 .htm 结尾。', requestId });
    }
    nextFilename = normalizedFilename;
  }

  const { data: version, error: versionError } = await options.supabase
    .from('deployment_versions')
    .insert({
      deployment_id: deploymentRow.id,
      version_number: versionNumber,
      title: nextTitle,
      description: requiredDescription,
      filename: nextFilename,
      file_path: publicUrl,
      file_size: fileSize,
    })
    .select()
    .single();
  if (versionError || !version) {
    return fail({
      status: 500,
      code: 'DEPLOYMENT_VERSION_INSERT_FAILED',
      message: 'HTML 版本记录写入失败。',
      detail: versionError?.message,
      requestId,
    });
  }

  const updatedAt = new Date().toISOString();
  const versionRow = version as VersionRow;
  const { error: updateError } = await options.supabase
    .from('deployments')
    .update({
      current_version_id: versionRow.id,
      title: nextTitle,
      description: requiredDescription,
      filename: nextFilename,
      file_path: publicUrl,
      file_size: fileSize,
      updated_at: updatedAt,
    })
    .eq('id', deploymentRow.id);
  if (updateError) {
    return fail({
      status: 500,
      code: 'DEPLOYMENT_UPDATE_FAILED',
      message: '部署记录更新失败。',
      detail: updateError.message,
      requestId,
    });
  }

  const links = pageLinks(options.publicOrigin, code, deploymentRow.id, versionNumber);
  return ok({
    success: true,
    requestId,
    id: deploymentRow.id,
    code,
    versionId: versionRow.id,
    versionNumber,
    updatedAt,
    fileSize,
    message: 'HTML 新版本已创建。',
    url: links.url,
    detailUrl: links.detailUrl,
    versionUrl: links.versionUrl,
    currentVersionId: versionRow.id,
    primaryVersionStrategy: deploymentRow.primary_version_strategy || 'likes',
  });
}

function hasOnlyOneActiveVersion(versions: VersionRow[], selectedVersionId: string) {
  const activeVersions = versions.filter((version) => (version.status || 'active') === 'active');
  return activeVersions.length <= 1 && activeVersions.some((version) => version.id === selectedVersionId);
}

export async function patchDeployVersion(options: {
  supabase: SupabaseClient;
  contentType: string;
  rawBody: string;
  publicOrigin: string;
  code: string;
  version: string;
}): Promise<ServiceResult> {
  const contentType = options.contentType || '';
  if (!contentType.includes('application/json')) {
    return fail({ status: 415, code: 'UNSUPPORTED_CONTENT_TYPE', message: '仅支持 application/json 请求。' });
  }
  const parsed = parseJsonBody(options.rawBody, crypto.randomUUID());
  if (parsed.error || !parsed.body) {
    return parsed.error || fail({ status: 400, code: 'INVALID_PAYLOAD', message: '请求体必须是单个 JSON 对象。' });
  }
  const body = parsed.body;
  if (!SHORT_CODE_PATTERN.test(options.code)) {
    return fail({ status: 400, code: 'INVALID_CODE', message: '短链后缀格式不合法。' });
  }

  const { data: deployment, error: deploymentError } = await options.supabase
    .from('deployments')
    .select('id, code, current_version_id, primary_version_strategy')
    .eq('code', options.code)
    .maybeSingle();
  if (deploymentError || !deployment) {
    return fail({
      status: 404,
      code: 'DEPLOYMENT_NOT_FOUND',
      message: '未找到对应版本。',
      detail: deploymentError?.message,
    });
  }
  const deploymentRow = deployment as DeploymentRow;
  const versionNumber = Number(options.version);
  const versionQuery = options.supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deploymentRow.id);
  const { data: selectedVersion, error: versionError } = await (Number.isInteger(versionNumber) && versionNumber > 0
    ? versionQuery.eq('version_number', versionNumber)
    : versionQuery.eq('id', options.version)
  ).maybeSingle();
  if (versionError || !selectedVersion) {
    return fail({
      status: 404,
      code: 'DEPLOYMENT_VERSION_NOT_FOUND',
      message: '未找到对应版本。',
      detail: versionError?.message,
    });
  }
  const versionRow = selectedVersion as VersionRow;
  if (Number(versionRow.like_count ?? 0) > 0) {
    return fail({
      status: 423,
      code: 'DEPLOYMENT_VERSION_LOCKED_BY_LIKE',
      message: '该版本已被点赞锁定，不能覆盖、下架或删除。',
      hint: '请创建新版本，或让用户在网页内取消该版本点赞后再操作。',
    });
  }

  const hasContent = typeof body.content === 'string';
  const requestedStatus = typeof body.status === 'string' ? body.status : undefined;
  if (requestedStatus && !['active', 'inactive'].includes(requestedStatus)) {
    return fail({ status: 400, code: 'INVALID_STATUS', message: 'status 必须是 active 或 inactive。' });
  }

  const versionsBeforeUpdate = await fetchVersions(options.supabase, deploymentRow.id);
  if (requestedStatus === 'inactive' && hasOnlyOneActiveVersion(versionsBeforeUpdate, versionRow.id)) {
    return fail({ status: 409, code: 'LAST_ACTIVE_VERSION', message: '不能下架最后一个可访问版本。' });
  }

  const patch: Record<string, unknown> = {};
  let oldStoragePath: string | null = null;
  const updatedAt = new Date().toISOString();

  if (hasContent) {
    const normalizedContent = String(body.content).trim();
    if (!normalizedContent) {
      return fail({ status: 400, code: 'INVALID_CONTENT', message: 'content 必须是非空字符串。' });
    }
    const description = normalizeDescription(body.description);
    if (!description) {
      return fail({
        status: 400,
        code: 'DESCRIPTION_REQUIRED',
        message: '项目介绍不能为空。',
        detail: '覆盖版本时必须提供 description，哪怕只有一句话。',
      });
    }
    const fileSize = byteLength(normalizedContent);
    if (fileSize > MAX_HTML_SIZE_BYTES) {
      return fail({
        status: 413,
        code: 'FILE_TOO_LARGE',
        message: 'HTML 文件体积超出限制。',
        detail: `当前大小 ${fileSize} bytes，最大允许 ${MAX_HTML_SIZE_BYTES} bytes。`,
      });
    }
    if (!isValidHtmlContent(normalizedContent)) {
      return fail({
        status: 400,
        code: 'INVALID_HTML',
        message: '提交内容不是有效的 HTML 文本。',
        detail: '内容中至少应包含 <!doctype html> 或 <html> 标签。',
      });
    }
    const filename = typeof body.filename === 'string' && body.filename.trim()
      ? body.filename.trim()
      : versionRow.filename;
    if (!/\.html?$/i.test(filename)) {
      return fail({ status: 400, code: 'INVALID_FILENAME', message: 'filename 必须以 .html 或 .htm 结尾。' });
    }

    const storagePath = createVersionedHtmlPath(options.code, versionRow.version_number);
    const bucket = options.supabase.storage.from('deployments');
    const { error: uploadError } = await bucket.upload(storagePath, normalizedContent, {
      contentType: 'text/html',
      cacheControl: '31536000',
      upsert: true,
    });
    if (uploadError) {
      return fail({
        status: 500,
        code: 'HTML_VERSION_UPLOAD_FAILED',
        message: 'HTML 版本覆盖上传失败。',
        detail: uploadError.message,
      });
    }
    oldStoragePath = getStoragePathFromFilePath(versionRow.file_path, options.code);
    patch.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : versionRow.title;
    patch.description = description;
    patch.filename = filename;
    patch.file_path = bucket.getPublicUrl(storagePath).data.publicUrl;
    patch.file_size = fileSize;
  }

  if (requestedStatus) patch.status = requestedStatus;
  patch.updated_at = updatedAt;

  const { data: updatedVersion, error: updateError } = await options.supabase
    .from('deployment_versions')
    .update(patch)
    .eq('id', versionRow.id)
    .select('*')
    .single();
  if (updateError || !updatedVersion) {
    return fail({
      status: 500,
      code: 'DEPLOYMENT_VERSION_UPDATE_FAILED',
      message: '版本更新失败。',
      detail: updateError?.message,
    });
  }
  const updated = updatedVersion as VersionRow;
  if (oldStoragePath && oldStoragePath !== getStoragePathFromFilePath(updated.file_path, options.code)) {
    const { error: removeError } = await options.supabase.storage.from('deployments').remove([oldStoragePath]);
    if (removeError) console.error('Remove old version file error:', removeError);
  }

  const versions = await fetchVersions(options.supabase, deploymentRow.id);
  const nextCurrent = selectPrimaryVersion(
    versions,
    deploymentRow.current_version_id,
    deploymentRow.primary_version_strategy || 'likes',
  );
  if (nextCurrent) {
    const { error: syncError } = await options.supabase
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
      .eq('id', deploymentRow.id);
    if (syncError) {
      return fail({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: '版本更新失败。',
        detail: syncError.message,
      });
    }
  }

  const links = pageLinks(options.publicOrigin, options.code, deploymentRow.id, updated.version_number);
  return ok({
    success: true,
    code: options.code,
    id: deploymentRow.id,
    versionId: updated.id,
    versionNumber: updated.version_number,
    status: updated.status || 'active',
    url: links.url,
    detailUrl: links.detailUrl,
    versionUrl: links.versionUrl,
    currentVersionId: nextCurrent?.id ?? null,
    fileSize: updated.file_size,
    description: updated.description,
    updatedAt,
  });
}
