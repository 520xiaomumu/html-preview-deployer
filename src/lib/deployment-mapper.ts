import { Deployment, DeploymentRow, DeploymentVersion, DeploymentVersionRow } from '@/lib/db';

export function mapDeploymentRow(row: DeploymentRow): Deployment {
  return {
    id: row.id,
    code: row.code,
    currentVersionId: row.current_version_id ?? null,
    title: row.title,
    description: row.description,
    filename: row.filename,
    filePath: row.file_path,
    fileSize: row.file_size,
    qrCodePath: row.qr_code_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewCount: row.view_count,
    likeCount: row.like_count ?? 0,
    status: row.status,
  };
}

export function mapDeploymentVersionRow(row: DeploymentVersionRow): DeploymentVersion {
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    versionNumber: row.version_number,
    title: row.title,
    description: row.description,
    filename: row.filename,
    filePath: row.file_path,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}
