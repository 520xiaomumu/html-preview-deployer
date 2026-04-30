import { Site, SiteRow, SiteVersion, SiteVersionRow } from '@/server/sites/types';

export function siteUrl(origin: string, slug: string) {
  return `${origin}/s/${slug}`;
}

export function versionUrl(origin: string, slug: string, versionNumber: number | null | undefined) {
  if (!versionNumber) return null;
  return `${origin}/s/${slug}@v${versionNumber}`;
}

export function mapSite(row: SiteRow, origin: string, currentVersionNumber?: number | null): Site {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    currentVersionId: row.current_version_id,
    viewCount: row.view_count,
    url: siteUrl(origin, row.slug),
    currentVersionUrl: versionUrl(origin, row.slug, currentVersionNumber),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSiteVersion(row: SiteVersionRow, origin: string, slug: string): SiteVersion {
  return {
    id: row.id,
    siteId: row.site_id,
    versionNumber: row.version_number,
    fileSize: row.file_size,
    checksum: row.checksum,
    title: row.title,
    message: row.message,
    url: versionUrl(origin, slug, row.version_number) || siteUrl(origin, slug),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
