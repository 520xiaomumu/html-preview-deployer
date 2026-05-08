import { NextRequest, NextResponse } from 'next/server';
import { DeploymentVersionRow, supabase } from '@/lib/db';
import { SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';
import { PrimaryVersionStrategy, selectPrimaryVersion } from '@/lib/version-selection';

export const dynamic = 'force-dynamic';

async function fetchDeploymentAndVersions(code: string) {
  if (!SHORT_CODE_PATTERN.test(code)) {
    return { status: 400, error: 'INVALID_CODE' as const, deployment: null, versions: [] as DeploymentVersionRow[] };
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, code, current_version_id, primary_version_strategy')
    .eq('code', code)
    .maybeSingle();

  if (deploymentError || !deployment) {
    return {
      status: 404,
      error: 'DEPLOYMENT_NOT_FOUND' as const,
      detail: deploymentError?.message,
      deployment: null,
      versions: [] as DeploymentVersionRow[],
    };
  }

  const { data: versions, error: versionsError } = await supabase
    .from('deployment_versions')
    .select('*')
    .eq('deployment_id', deployment.id)
    .order('version_number', { ascending: false });

  if (versionsError) {
    return {
      status: 500,
      error: 'DEPLOYMENT_VERSIONS_FETCH_FAILED' as const,
      detail: versionsError.message,
      deployment: null,
      versions: [] as DeploymentVersionRow[],
    };
  }

  return {
    status: 200,
    error: null,
    deployment,
    versions: (versions || []) as DeploymentVersionRow[],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const found = await fetchDeploymentAndVersions(code);

    if (found.error || !found.deployment) {
      return jsonError({
        status: found.status,
        code: found.error || 'DEPLOYMENT_NOT_FOUND',
        message: found.error === 'INVALID_CODE' ? '短链后缀格式不合法。' : '主域名策略读取失败。',
        detail: found.detail,
      });
    }

    const strategy = (found.deployment.primary_version_strategy || 'likes') as PrimaryVersionStrategy;
    const primaryVersion = selectPrimaryVersion(found.versions, found.deployment.current_version_id, strategy);

    return NextResponse.json(
      {
        success: true,
        code: found.deployment.code,
        primaryVersionStrategy: strategy,
        primaryVersionId: primaryVersion?.id ?? null,
        primaryVersionNumber: primaryVersion?.version_number ?? null,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '主域名策略读取失败。',
      detail: getErrorMessage(error),
    });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonError({ status: 415, code: 'UNSUPPORTED_CONTENT_TYPE', message: '仅支持 application/json 请求。' });
    }

    const body = await request.json();
    const strategy = body?.primaryVersionStrategy || body?.strategy;
    if (strategy !== 'likes' && strategy !== 'latest') {
      return jsonError({
        status: 400,
        code: 'INVALID_PRIMARY_VERSION_STRATEGY',
        message: 'primaryVersionStrategy 必须是 likes 或 latest。',
      });
    }

    const { code } = await params;
    const found = await fetchDeploymentAndVersions(code);

    if (found.error || !found.deployment) {
      return jsonError({
        status: found.status,
        code: found.error || 'DEPLOYMENT_NOT_FOUND',
        message: found.error === 'INVALID_CODE' ? '短链后缀格式不合法。' : '主域名策略更新失败。',
        detail: found.detail,
      });
    }

    const primaryVersion = selectPrimaryVersion(found.versions, found.deployment.current_version_id, strategy);
    if (!primaryVersion) {
      return jsonError({
        status: 409,
        code: 'NO_ACTIVE_VERSION',
        message: '没有可用于主域名的上架版本。',
      });
    }

    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        primary_version_strategy: strategy,
        current_version_id: primaryVersion.id,
        title: primaryVersion.title,
        description: primaryVersion.description,
        filename: primaryVersion.filename,
        file_path: primaryVersion.file_path,
        file_size: primaryVersion.file_size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', found.deployment.id);

    if (updateError) {
      return jsonError({
        status: 500,
        code: 'PRIMARY_VERSION_STRATEGY_UPDATE_FAILED',
        message: '主域名策略更新失败。',
        detail: updateError.message,
      });
    }

    return NextResponse.json(
      {
        success: true,
        code: found.deployment.code,
        primaryVersionStrategy: strategy,
        primaryVersionId: primaryVersion.id,
        primaryVersionNumber: primaryVersion.version_number,
        currentVersionId: primaryVersion.id,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '主域名策略更新失败。',
      detail: getErrorMessage(error),
    });
  }
}
