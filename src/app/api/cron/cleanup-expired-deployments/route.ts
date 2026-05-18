import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { jsonError } from '@/lib/api-response';
import { deleteDeploymentFilesAndRecord } from '@/lib/deployment-delete';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

const CLEANUP_LIMIT = 50;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
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
    const nowIso = new Date().toISOString();
    const { data: candidates, error } = await supabase
      .from('deployments')
      .select('id, code, like_count, expires_at')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso)
      .eq('like_count', 0)
      .order('expires_at', { ascending: true })
      .limit(CLEANUP_LIMIT);

    if (error) {
      return jsonError({
        status: 500,
        code: 'EXPIRED_DEPLOYMENTS_FETCH_FAILED',
        message: '读取过期部署失败。',
        detail: error.message,
      });
    }

    const deleted: Array<{ id: string; code: string }> = [];
    const skipped: Array<{ id: string; code: string; reason: string }> = [];
    const failed: Array<{ id: string; code: string; error: string }> = [];

    for (const deployment of candidates || []) {
      const { count, error: countError } = await supabase
        .from('deployment_versions')
        .select('id', { count: 'exact', head: true })
        .eq('deployment_id', deployment.id);

      if (countError) {
        failed.push({ id: deployment.id, code: deployment.code, error: countError.message });
        continue;
      }

      if ((count ?? 0) !== 1) {
        await supabase
          .from('deployments')
          .update({ expires_at: null })
          .eq('id', deployment.id);
        skipped.push({ id: deployment.id, code: deployment.code, reason: 'has_versions' });
        continue;
      }

      try {
        await deleteDeploymentFilesAndRecord({ id: deployment.id, code: deployment.code });
        deleted.push({ id: deployment.id, code: deployment.code });
      } catch (deleteError: unknown) {
        failed.push({ id: deployment.id, code: deployment.code, error: getErrorMessage(deleteError) });
      }
    }

    return NextResponse.json({
      success: true,
      checked: candidates?.length || 0,
      deletedCount: deleted.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      deleted,
      skipped,
      failed,
    });
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'EXPIRED_DEPLOYMENTS_CLEANUP_FAILED',
      message: '清理过期部署失败。',
      detail: getErrorMessage(error),
    });
  }
}
