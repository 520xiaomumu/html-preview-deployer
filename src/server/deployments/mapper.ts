import { Deployment, DeploymentRow } from '@/server/deployments/types';

export function deploymentUrl(origin: string, code: string) {
  return `${origin}/s/${code}`;
}

export function mapDeployment(row: DeploymentRow, origin: string): Deployment {
  return {
    id: row.id,
    ownerId: row.owner_id || 'legacy',
    code: row.code,
    title: row.title,
    filename: row.filename,
    fileSize: row.file_size,
    status: row.status,
    visibility: row.visibility || 'public',
    viewCount: row.view_count,
    url: deploymentUrl(origin, row.code),
    contentUrl: `${origin}/api/v1/deployments/${row.id}/content`,
    qrCodeUrl: `${origin}/api/deploy/${row.code}/qrcode`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
