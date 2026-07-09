import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { jsonError } from '@/lib/api-response';
import { deleteDeploymentFilesAndRecord } from '@/lib/deployment-delete';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

const CANDIDATE_PAGE_SIZE = 500;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

async function fetchCleanupCandidates() {
  const candidates: Array<{ id: string; code: string; like_count: number | null }> = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('deployments')
      .select('id, code, like_count')
      .or('like_count.eq.0,like_count.is.null')
      .order('created_at', { ascending: true })
      .range(from, from + CANDIDATE_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    const versionCounts = new Map<string, number>();
    const { data: versionRows, error: versionError } = await supabase
      .from('deployment_versions')
      .select('deployment_id')
      .in('deployment_id', data.map((deployment) => deployment.id));

    if (versionError) throw versionError;
    for (const row of versionRows || []) {
      versionCounts.set(row.deployment_id, (versionCounts.get(row.deployment_id) || 0) + 1);
    }

    candidates.push(...data.filter((deployment) => (versionCounts.get(deployment.id) || 0) === 1));
    if (data.length < CANDIDATE_PAGE_SIZE) break;
    from += CANDIDATE_PAGE_SIZE;
  }

  return candidates;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: '缺少有效的 cron 授权。',
    });
  }

  try {
    const candidates = await fetchCleanupCandidates();
    const deleted: Array<{ id: string; code: string }> = [];
    const failed: Array<{ id: string; code: string; error: string }> = [];

    for (const deployment of candidates) {
      try {
        await deleteDeploymentFilesAndRecord({ id: deployment.id, code: deployment.code });
        deleted.push({ id: deployment.id, code: deployment.code });
      } catch (deleteError: unknown) {
        failed.push({ id: deployment.id, code: deployment.code, error: getErrorMessage(deleteError) });
      }
    }

    console.log('cleanup-unpreserved-deployments', {
      checked: candidates.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
    });

    return NextResponse.json({
      success: true,
      checked: candidates.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted,
      failed,
    });
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'UNPRESERVED_DEPLOYMENTS_CLEANUP_FAILED',
      message: '清理未保留部署失败。',
      detail: getErrorMessage(error),
    });
  }
}
