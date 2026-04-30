import { AppError } from '@/server/errors';
import { getSupabaseAdmin } from '@/server/storage/supabase';
import { mapSite, mapSiteVersion, siteUrl, versionUrl } from '@/server/sites/mapper';
import { PublishInput, PublishResult, SiteRow, SiteVersionRow, SiteVisibility } from '@/server/sites/types';
import {
  normalizeFilename,
  normalizeHtmlContent,
  normalizeSlug,
  normalizeVisibility,
  optionalString,
  slugFromFilename,
} from '@/server/sites/validation';

type PublishRpcResult = {
  site_id: string;
  version_id: string | null;
  version_number: number | null;
  changed: boolean;
  is_new_site: boolean;
};

function parsePublishRpcResult(value: unknown): PublishRpcResult {
  const result = value as Partial<PublishRpcResult> | null;
  if (!result?.site_id) {
    throw new AppError(500, 'DATABASE_ERROR', 'Invalid publish result.');
  }

  return {
    site_id: result.site_id,
    version_id: result.version_id || null,
    version_number: result.version_number ?? null,
    changed: Boolean(result.changed),
    is_new_site: Boolean(result.is_new_site),
  };
}

export function parseVersionedSlug(value: string) {
  const match = value.match(/^(.+)@v([1-9][0-9]*)$/);
  if (!match) return { slug: value, version: null };
  return {
    slug: match[1],
    version: Number(match[2]),
  };
}

export async function publishSiteVersion(input: PublishInput): Promise<PublishResult> {
  const filename = normalizeFilename(input.filename);
  const fallbackSlug = slugFromFilename(filename);
  const slug = normalizeSlug(input.slug || fallbackSlug);
  const title = optionalString(input.title, 120);
  const description = optionalString(input.description, 240);
  const message = optionalString(input.message, 500);
  const visibility = normalizeVisibility(input.visibility);
  const html = normalizeHtmlContent(input.content);

  const { data, error } = await getSupabaseAdmin().rpc('publish_site_version', {
    p_owner_id: input.ownerId,
    p_slug: slug,
    p_title: title,
    p_description: description,
    p_visibility: visibility || '',
    p_html: html.content,
    p_file_size: html.size,
    p_checksum: html.checksum,
    p_message: message,
    p_created_by: input.actorId,
  });

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to publish site version.', error.message);
  }

  const result = parsePublishRpcResult(data);
  return {
    siteId: result.site_id,
    slug,
    versionId: result.version_id,
    versionNumber: result.version_number,
    changed: result.changed,
    isNewSite: result.is_new_site,
    url: siteUrl(input.origin, slug),
    versionUrl: versionUrl(input.origin, slug, result.version_number),
    fileSize: html.size,
    checksum: html.checksum,
  };
}

export async function listSites(ownerId: string, origin: string, searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')));
  const visibility = searchParams.get('visibility');
  const queryText = (searchParams.get('q') || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabaseAdmin()
    .from('sites')
    .select('*', { count: 'exact' })
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (visibility === 'public' || visibility === 'unlisted' || visibility === 'private') {
    query = query.eq('visibility', visibility);
  }

  if (queryText) {
    const escaped = queryText.replace(/,/g, '\\,').replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to list sites.', error.message);
  }

  const total = count || 0;
  return {
    items: (data || []).map((row) => mapSite(row as SiteRow, origin)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSite(ownerId: string, id: string, origin: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('sites')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch site.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  return mapSite(data as SiteRow, origin);
}

export async function getSiteBySlug(ownerId: string, slugInput: string, origin: string) {
  const slug = normalizeSlug(slugInput);
  const { data, error } = await getSupabaseAdmin()
    .from('sites')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch site.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  return mapSite(data as SiteRow, origin);
}

export async function updateSiteMeta(
  ownerId: string,
  id: string,
  origin: string,
  updates: { title?: unknown; description?: unknown; visibility?: unknown }
) {
  const patch: {
    title?: string;
    description?: string;
    visibility?: SiteVisibility;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  const title = optionalString(updates.title, 120);
  const description = optionalString(updates.description, 240);
  const visibility = normalizeVisibility(updates.visibility);
  if (title) patch.title = title;
  if (description) patch.description = description;
  if (visibility) patch.visibility = visibility;

  const { data, error } = await getSupabaseAdmin()
    .from('sites')
    .update(patch)
    .eq('owner_id', ownerId)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to update site.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  return mapSite(data as SiteRow, origin);
}

export async function deleteSite(ownerId: string, id: string) {
  const { error, count } = await getSupabaseAdmin()
    .from('sites')
    .delete({ count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('id', id);

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to delete site.', error.message);
  }

  if (!count) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  return { deleted: true, id };
}

export async function listSiteVersions(ownerId: string, siteId: string, origin: string) {
  const site = await getSite(ownerId, siteId, origin);
  const { data, error } = await getSupabaseAdmin()
    .from('site_versions')
    .select('id, site_id, version_number, file_size, checksum, title, message, created_by, created_at')
    .eq('site_id', siteId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to list site versions.', error.message);
  }

  return {
    site,
    items: (data || []).map((row) => mapSiteVersion(row as SiteVersionRow, origin, site.slug)),
  };
}

export async function rollbackSite(ownerId: string, siteId: string, version: unknown, origin: string) {
  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'version must be a positive integer.');
  }

  const { data, error } = await getSupabaseAdmin().rpc('rollback_site_version', {
    p_owner_id: ownerId,
    p_site_id: siteId,
    p_version_number: versionNumber,
  });

  if (error) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site version not found.', error.message);
  }

  const site = await getSite(ownerId, siteId, origin);
  return {
    site,
    rollback: data,
  };
}

export async function readSiteContent(ownerId: string, siteId: string) {
  const site = await getSite(ownerId, siteId, 'http://localhost');
  if (!site.currentVersionId) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site has no published version.');
  }

  const { data, error } = await getSupabaseAdmin()
    .from('site_versions')
    .select('html_content')
    .eq('site_id', siteId)
    .eq('id', site.currentVersionId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to read site content.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site version not found.');
  }

  return String(data.html_content || '');
}

export async function readSiteContentBySlug(ownerId: string, slugInput: string) {
  const slug = normalizeSlug(slugInput);
  const { data, error } = await getSupabaseAdmin()
    .from('sites')
    .select('id, current_version_id')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to read site content.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  if (!data.current_version_id) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site has no published version.');
  }

  const { data: version, error: versionError } = await getSupabaseAdmin()
    .from('site_versions')
    .select('html_content')
    .eq('site_id', data.id)
    .eq('id', data.current_version_id)
    .maybeSingle();

  if (versionError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to read site content.', versionError.message);
  }

  if (!version) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site has no published version.');
  }

  return String(version.html_content || '');
}

export async function servePublicSite(slugWithVersion: string) {
  const parsed = parseVersionedSlug(slugWithVersion);
  const slug = normalizeSlug(parsed.slug);

  const { data: siteData, error: siteError } = await getSupabaseAdmin()
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (siteError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch site.', siteError.message);
  }

  if (!siteData) {
    throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found.');
  }

  const site = siteData as SiteRow;
  if (site.visibility === 'private') {
    throw new AppError(403, 'FORBIDDEN', 'Site is private.');
  }

  let query = getSupabaseAdmin()
    .from('site_versions')
    .select('id, version_number, html_content')
    .eq('site_id', site.id);

  query = parsed.version
    ? query.eq('version_number', parsed.version)
    : query.eq('id', site.current_version_id || '');

  const { data: versionData, error: versionError } = await query.maybeSingle();
  if (versionError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch site version.', versionError.message);
  }

  if (!versionData) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Site version not found.');
  }

  void getSupabaseAdmin().rpc('increment_site_view_count', { target_id: site.id });

  return {
    content: String(versionData.html_content || ''),
    versionNumber: Number(versionData.version_number),
    pinned: Boolean(parsed.version),
  };
}
