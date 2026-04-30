export type SiteVisibility = 'public' | 'unlisted' | 'private';

export type SiteRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  visibility: SiteVisibility;
  current_version_id: string | null;
  view_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteVersionRow = {
  id: string;
  site_id: string;
  version_number: number;
  html_content: string;
  file_size: number;
  checksum: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

export type Site = {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  description: string;
  visibility: SiteVisibility;
  currentVersionId: string | null;
  viewCount: number;
  url: string;
  currentVersionUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteVersion = {
  id: string;
  siteId: string;
  versionNumber: number;
  fileSize: number;
  checksum: string;
  title: string;
  message: string;
  url: string;
  createdBy: string | null;
  createdAt: string;
};

export type PublishInput = {
  ownerId: string;
  actorId: string | null;
  slug: unknown;
  content: unknown;
  filename?: unknown;
  title?: unknown;
  description?: unknown;
  visibility?: unknown;
  message?: unknown;
  origin: string;
};

export type PublishResult = {
  siteId: string;
  slug: string;
  versionId: string | null;
  versionNumber: number | null;
  changed: boolean;
  isNewSite: boolean;
  url: string;
  versionUrl: string | null;
  fileSize: number;
  checksum: string;
};
