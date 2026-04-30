import { randomBytes } from 'node:crypto';
import { AppError } from '@/server/errors';
import { DEPLOYMENTS_BUCKET, getSupabaseAdmin } from '@/server/storage/supabase';
import { mapDeployment } from '@/server/deployments/mapper';
import {
  CreateDeploymentInput,
  Deployment,
  DeploymentRow,
  DeploymentStatus,
  UpdateDeploymentContentInput,
} from '@/server/deployments/types';
import {
  normalizeFilename,
  normalizeHtmlContent,
  normalizeShortCode,
  normalizeVisibility,
  optionalString,
} from '@/server/deployments/validation';

function asDeploymentRow(value: unknown) {
  return value as DeploymentRow;
}

function getHtmlPath(row: DeploymentRow) {
  if (row.html_path) return row.html_path;
  return getStoragePathFromPublicUrl(row.file_path, `html/${row.code}.html`);
}

function hasInlineContent(row: DeploymentRow) {
  return typeof row.html_content === 'string' && row.html_content.length > 0;
}

function getQrPath(row: DeploymentRow) {
  if (row.qr_path) return row.qr_path;
  return getStoragePathFromPublicUrl(row.qr_code_path, `qrcodes/${row.code}.png`);
}

function getStoragePathFromPublicUrl(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    const marker = `/${DEPLOYMENTS_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return fallback;
    return parsed.pathname.slice(index + marker.length);
  } catch {
    return fallback;
  }
}

function createRandomCode() {
  return randomBytes(4).toString('base64url').replace(/_/g, 'x').replace(/-/g, 'z').slice(0, 6).toLowerCase();
}

async function ensureCodeAvailable(code: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('deployments')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to check short code.', error.message);
  }

  if (data) {
    throw new AppError(409, 'CODE_TAKEN', 'Short code is already taken.');
  }
}

async function generateUniqueCode() {
  for (let index = 0; index < 8; index += 1) {
    const candidate = createRandomCode();
    try {
      await ensureCodeAvailable(candidate);
      return candidate;
    } catch (error) {
      if (error instanceof AppError && error.code === 'CODE_TAKEN') continue;
      throw error;
    }
  }

  throw new AppError(500, 'DATABASE_ERROR', 'Failed to generate a unique short code.');
}

export async function createDeployment(input: CreateDeploymentInput): Promise<Deployment> {
  const supabase = getSupabaseAdmin();
  const filename = normalizeFilename(input.filename);
  const { content, size } = normalizeHtmlContent(input.content);
  const requestedCode = normalizeShortCode(input.code);
  normalizeVisibility(input.visibility);
  const code = requestedCode || await generateUniqueCode();

  if (requestedCode) {
    await ensureCodeAvailable(requestedCode);
  }

  const initialTitle = input.title?.trim() || filename.replace(/\.html?$/i, '');
  const { data: inserted, error: insertError } = await supabase
    .from('deployments')
    .insert({
      code,
      title: initialTitle,
      filename,
      file_path: `${input.origin}/s/${code}`,
      qr_code_path: `${input.origin}/api/deploy/${code}/qrcode`,
      html_content: content,
      file_size: size,
      status: 'active',
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to create deployment record.', insertError?.message);
  }

  const row = asDeploymentRow(inserted);
  return mapDeployment(row, input.origin);
}

export async function listDeployments(actorId: string, origin: string, searchParams: URLSearchParams) {
  const supabase = getSupabaseAdmin();
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')));
  const status = searchParams.get('status');
  const queryText = (searchParams.get('q') || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('deployments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status === 'active' || status === 'inactive') {
    query = query.eq('status', status);
  }

  if (queryText) {
    const escaped = queryText.replace(/,/g, '\\,').replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(`title.ilike.%${escaped}%,filename.ilike.%${escaped}%,code.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to list deployments.', error.message);
  }

  const rows = (data || []).map(asDeploymentRow);
  const total = count || 0;
  return {
    items: rows.map((row) => mapDeployment(row, origin)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getDeploymentForActor(id: string, actorId: string, origin: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch deployment.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  }

  return mapDeployment(asDeploymentRow(data), origin);
}

export async function getDeploymentByCodeForActor(code: string, actorId: string, origin: string) {
  const normalizedCode = normalizeShortCode(code);
  if (!normalizedCode) {
    throw new AppError(400, 'INVALID_CODE', 'code is required.');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('deployments')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch deployment.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  }

  return mapDeployment(asDeploymentRow(data), origin);
}

export async function updateDeploymentMeta(
  id: string,
  actorId: string,
  origin: string,
  updates: { status?: unknown; visibility?: unknown; title?: unknown }
) {
  const patch: {
    status?: DeploymentStatus;
    title?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status != null) {
    if (updates.status !== 'active' && updates.status !== 'inactive') {
      throw new AppError(400, 'INVALID_PAYLOAD', 'status must be active or inactive.');
    }
    patch.status = updates.status;
  }

  if (updates.visibility != null) normalizeVisibility(updates.visibility);

  const title = optionalString(updates.title);
  if (title) patch.title = title;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('deployments')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to update deployment.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  }

  return mapDeployment(asDeploymentRow(data), origin);
}

export async function readDeploymentContent(id: string, actorId: string) {
  const row = await getDeploymentRowForActor(id, actorId);
  if (hasInlineContent(row)) return row.html_content || '';
  return downloadText(getHtmlPath(row));
}

export async function updateDeploymentContent(input: UpdateDeploymentContentInput) {
  const filename = input.filename ? normalizeFilename(input.filename) : undefined;
  const title = optionalString(input.title);
  const { content, size } = normalizeHtmlContent(input.content);
  const row = await getDeploymentRowForActor(input.id, input.actorId);
  const nextFilename = filename || row.filename;
  const patch: {
    file_size: number;
    filename: string;
    html_content: string;
    title?: string;
    updated_at: string;
  } = {
    file_size: size,
    filename: nextFilename,
    html_content: content,
    updated_at: new Date().toISOString(),
  };
  if (title) patch.title = title;

  const { data, error } = await getSupabaseAdmin()
    .from('deployments')
    .update(patch)
    .eq('id', row.id)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to update deployment record.', error?.message);
  }

  return mapDeployment(asDeploymentRow(data), input.origin);
}

export async function deleteDeployment(id: string, actorId: string) {
  const row = await getDeploymentRowForActor(id, actorId);
  if (!hasInlineContent(row)) {
    const bucket = getSupabaseAdmin().storage.from(DEPLOYMENTS_BUCKET);
    const paths = [getHtmlPath(row), getQrPath(row)];
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) {
      throw new AppError(500, 'STORAGE_ERROR', 'Failed to remove deployment files.', removeError.message);
    }
  }

  const { error } = await getSupabaseAdmin()
    .from('deployments')
    .delete()
    .eq('id', row.id);

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to delete deployment.', error.message);
  }

  return { deleted: true, id };
}

export async function servePublicDeployment(code: string) {
  const normalizedCode = normalizeShortCode(code);
  if (!normalizedCode) {
    throw new AppError(400, 'INVALID_CODE', 'code is required.');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('deployments')
    .select('*')
    .eq('code', normalizedCode)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch public deployment.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found or inactive.');
  }

  const row = asDeploymentRow(data);
  void supabase.rpc('increment_deployment_view_count', { target_id: row.id });
  const content = hasInlineContent(row) ? row.html_content || '' : await downloadText(getHtmlPath(row));
  return {
    content,
    filename: row.filename,
  };
}

export async function readDeploymentQrCode(id: string, actorId: string) {
  const row = await getDeploymentRowForActor(id, actorId);
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(DEPLOYMENTS_BUCKET)
    .download(getQrPath(row));

  if (error || !data) {
    throw new AppError(404, 'CONTENT_NOT_FOUND', 'QR code not found.', error?.message);
  }

  return data;
}

async function getDeploymentRowForActor(id: string, _actorId: string) {
  void _actorId;
  const { data, error } = await getSupabaseAdmin()
    .from('deployments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch deployment.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  }

  return asDeploymentRow(data);
}

async function downloadText(path: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(DEPLOYMENTS_BUCKET)
    .download(path);

  if (error || !data) {
    throw new AppError(404, 'CONTENT_NOT_FOUND', 'HTML content not found.', error?.message);
  }

  return data.text();
}
