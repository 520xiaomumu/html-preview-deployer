import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { jsonError } from '@/lib/api-response';
import { deleteDeploymentFilesAndRecord } from '@/lib/deployment-delete';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CANDIDATE_PAGE_SIZE = 500;
const DELETE_CONCURRENCY = 20;

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
      .select('id, code, like_count, deployment_versions!deployment_versions_deployment_id_fkey(count)')
      .or('like_count.eq.0,like_count.is.null')
      .order('created_at', { ascending: true })
      .range(from, from + CANDIDATE_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    candidates.push(...data.filter((deployment) => deployment.deployment_versions[0]?.count === 1));
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

    for (let from = 0; from < candidates.length; from += DELETE_CONCURRENCY) {
      await Promise.all(candidates.slice(from, from + DELETE_CONCURRENCY).map(async (deployment) => {
        try {
          await deleteDeploymentFilesAndRecord({ id: deployment.id, code: deployment.code });
          deleted.push({ id: deployment.id, code: deployment.code });
        } catch (deleteError: unknown) {
          failed.push({ id: deployment.id, code: deployment.code, error: getErrorMessage(deleteError) });
        }
      }));
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
