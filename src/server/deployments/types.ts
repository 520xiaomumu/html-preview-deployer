export type DeploymentStatus = 'active' | 'inactive';
export type DeploymentVisibility = 'public' | 'private' | 'unlisted';

export type DeploymentRow = {
  id: string;
  owner_id?: string | null;
  code: string;
  title: string;
  filename: string;
  html_path?: string | null;
  qr_path?: string | null;
  html_content?: string | null;
  qr_code_base64?: string | null;
  file_path?: string | null;
  qr_code_path?: string | null;
  content?: string | null;
  file_size: number | null;
  status: DeploymentStatus;
  visibility: DeploymentVisibility;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type Deployment = {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  filename: string;
  fileSize: number | null;
  status: DeploymentStatus;
  visibility: DeploymentVisibility;
  viewCount: number;
  url: string;
  contentUrl: string;
  qrCodeUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeploymentInput = {
  actorId: string;
  content: string;
  filename: string;
  title?: string;
  code?: string;
  origin: string;
  visibility?: unknown;
};

export type UpdateDeploymentContentInput = {
  id: string;
  actorId: string;
  content: string;
  filename?: string;
  title?: string;
  origin: string;
};
