import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonError({
        status: 415,
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: '仅支持 application/json 请求。',
      });
    }

    const body = await request.json();
    const versionNumber = Number(body?.versionNumber);
    const versionId = typeof body?.versionId === 'string' ? body.versionId : null;

    if (!versionId && (!Number.isInteger(versionNumber) || versionNumber <= 0)) {
      return jsonError({
        status: 400,
        code: 'INVALID_VERSION',
        message: '请提供 versionId 或有效的 versionNumber。',
      });
    }

    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('id, code, like_count')
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

    let versionQuery = supabase
      .from('deployment_versions')
      .select('*')
      .eq('deployment_id', deployment.id);

    versionQuery = versionId
      ? versionQuery.eq('id', versionId)
      : versionQuery.eq('version_number', versionNumber);

    const { data: version, error: versionError } = await versionQuery.maybeSingle();

    if (versionError || !version) {
      return jsonError({
        status: 404,
        code: 'DEPLOYMENT_VERSION_NOT_FOUND',
        message: '未找到指定版本。',
        detail: versionError?.message,
      });
    }

    if (version.status === 'inactive') {
      return jsonError({
        status: 409,
        code: 'DEPLOYMENT_VERSION_INACTIVE',
        message: '已下架版本不能设为当前版本。',
      });
    }

    const updatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        current_version_id: version.id,
        title: version.title,
        description: version.description,
        filename: version.filename,
        file_path: version.file_path,
        file_size: version.file_size,
        updated_at: updatedAt,
      })
      .eq('id', deployment.id);

    if (updateError) {
      return jsonError({
        status: 500,
        code: 'CURRENT_VERSION_UPDATE_FAILED',
        message: '当前版本切换失败。',
        detail: updateError.message,
      });
    }

    return NextResponse.json(
      {
        success: true,
        code: deployment.code,
        currentVersionId: version.id,
        versionNumber: version.version_number,
        updatedAt,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '当前版本切换失败。',
      detail: getErrorMessage(error),
    });
  }
}
