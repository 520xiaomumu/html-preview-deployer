import { Deployment, DeploymentRow } from '@/lib/db';

export function mapDeploymentRow(row: DeploymentRow): Deployment {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    filename: row.filename,
    filePath: row.file_path,
    fileSize: row.file_size,
    qrCodePath: row.qr_code_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewCount: row.view_count,
    status: row.status,
  };
}
