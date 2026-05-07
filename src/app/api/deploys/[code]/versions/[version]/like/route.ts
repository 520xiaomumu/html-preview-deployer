import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { jsonError, withNoStoreHeaders } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/error';

export const dynamic = 'force-dynamic';

type VersionLikeError = { error: string; detail?: string };
type VersionLikeSuccess = {
  deployment: { id: string; code: string; status: string; like_count: number | null };
  version: { id: string; deployment_id: string; version_number: number; like_count: number | null };
  versionLikeCount: number;
  deploymentLikeCount: number;
};

function isSameOriginBrowserRequest(request: NextRequest) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const currentOrigin = request.nextUrl.origin;
  const fetchSite = request.headers.get('sec-fetch-site');

  return (origin === currentOrigin || Boolean(referer?.startsWith(`${currentOrigin}/`)))
    && (fetchSite === 'same-origin' || fetchSite === 'none');
}

async function fetchVersion(code: string, version: string): Promise<VersionLikeError | Omit<VersionLikeSuccess, 'versionLikeCount' | 'deploymentLikeCount'>> {
  if (!SHORT_CODE_PATTERN.test(code)) {
    return { error: 'INVALID_CODE' as const };
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, code, status, like_count')
    .eq('code', code)
    .maybeSingle();

  if (deploymentError || !deployment) {
    return { error: 'DEPLOYMENT_NOT_FOUND' as const, detail: deploymentError?.message };
  }

  const versionNumber = Number(version);
  let versionQuery = supabase
    .from('deployment_versions')
    .select('id, deployment_id, version_number, like_count')
    .eq('deployment_id', deployment.id);

  versionQuery = Number.isInteger(versionNumber) && versionNumber > 0
    ? versionQuery.eq('version_number', versionNumber)
    : versionQuery.eq('id', version);

  const { data: selectedVersion, error: versionError } = await versionQuery.maybeSingle();
  if (versionError || !selectedVersion) {
    return { error: 'DEPLOYMENT_VERSION_NOT_FOUND' as const, detail: versionError?.message };
  }

  return { deployment, version: selectedVersion };
}

async function updateVersionLike(code: string, version: string, action: 'increment' | 'decrement'): Promise<VersionLikeError | VersionLikeSuccess> {
  const found = await fetchVersion(code, version);
  if ('error' in found) return found;

  if (action === 'increment' && found.deployment.status !== 'active') {
    return { error: 'DEPLOYMENT_INACTIVE' as const };
  }

  const functionName = action === 'increment'
    ? 'increment_deployment_version_like_count'
    : 'decrement_deployment_version_like_count';
  const { data: likeRows, error: likeError } = await supabase.rpc(functionName, {
    target_version_id: found.version.id,
  });

  if (likeError) {
    return { error: action === 'increment' ? 'LIKE_FAILED' as const : 'UNLIKE_FAILED' as const, detail: likeError.message };
  }

  return {
    deployment: found.deployment,
    version: found.version,
    versionLikeCount: Number(likeRows?.[0]?.version_like_count ?? found.version.like_count ?? 0),
    deploymentLikeCount: Number(likeRows?.[0]?.deployment_like_count ?? found.deployment.like_count ?? 0),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> },
) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return jsonError({ status: 403, code: 'MANUAL_LIKE_REQUIRED', message: '点赞只能从网页内手动操作。' });
    }

    const { code, version } = await params;
    const result = await updateVersionLike(code, version, 'increment');

    if ('error' in result) {
      const errorCode = result.error || 'LIKE_FAILED';
      const status = errorCode === 'DEPLOYMENT_INACTIVE' ? 409 : errorCode.includes('NOT_FOUND') ? 404 : 500;
      return jsonError({ status, code: errorCode, message: '版本点赞失败。', detail: result.detail });
    }

    return NextResponse.json(
      {
        success: true,
        id: result.deployment.id,
        code: result.deployment.code,
        versionId: result.version.id,
        versionNumber: result.version.version_number,
        versionLikeCount: result.versionLikeCount,
        likeCount: result.deploymentLikeCount,
        locked: result.deploymentLikeCount > 0,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({ status: 500, code: 'INTERNAL_ERROR', message: '版本点赞失败。', detail: getErrorMessage(error) });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> },
) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return jsonError({ status: 403, code: 'MANUAL_UNLIKE_REQUIRED', message: '取消点赞只能从网页内手动操作。' });
    }

    const { code, version } = await params;
    const result = await updateVersionLike(code, version, 'decrement');

    if ('error' in result) {
      const errorCode = result.error || 'UNLIKE_FAILED';
      const status = errorCode.includes('NOT_FOUND') ? 404 : 500;
      return jsonError({ status, code: errorCode, message: '取消版本点赞失败。', detail: result.detail });
    }

    return NextResponse.json(
      {
        success: true,
        id: result.deployment.id,
        code: result.deployment.code,
        versionId: result.version.id,
        versionNumber: result.version.version_number,
        versionLikeCount: result.versionLikeCount,
        likeCount: result.deploymentLikeCount,
        locked: result.deploymentLikeCount > 0,
      },
      withNoStoreHeaders(),
    );
  } catch (error: unknown) {
    return jsonError({ status: 500, code: 'INTERNAL_ERROR', message: '取消版本点赞失败。', detail: getErrorMessage(error) });
  }
}
