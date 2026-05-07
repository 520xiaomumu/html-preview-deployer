import { NextRequest, NextResponse } from 'next/server';
import { DeploymentVersionRow, supabase } from '@/lib/db';
import { mapDeploymentVersionRow } from '@/lib/deployment-mapper';
import { SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!SHORT_CODE_PATTERN.test(code)) {
      return jsonError({
        status: 400,
        code: 'INVALID_CODE',
        message: '短链后缀格式不合法。',
      });
    }

    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('id, code, current_version_id')
      .eq('code', code)
      .maybeSingle();

    if (deploymentError || !deployment) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: '未找到对应部署。',
        detail: deploymentError?.message,
      });
    }

    const { data: versions, error: versionsError } = await supabase
      .from('deployment_versions')
      .select('*')
      .eq('deployment_id', deployment.id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      return jsonError({
        status: 500,
        code: 'DEPLOYMENT_VERSIONS_FETCH_FAILED',
        message: '版本历史读取失败。',
        detail: versionsError.message,
      });
    }

    return NextResponse.json(
      {
        success: true,
        code: deployment.code,
        currentVersionId: deployment.current_version_id,
        versions: ((versions || []) as DeploymentVersionRow[]).map(mapDeploymentVersionRow),
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '版本历史读取失败。',
      detail: getErrorMessage(error),
    });
  }
}
