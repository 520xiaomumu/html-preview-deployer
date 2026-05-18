import { NextRequest, NextResponse } from 'next/server';
import { DeploymentRow, supabase } from '@/lib/db';
import { mapDeploymentRow } from '@/lib/deployment-mapper';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';
import { jsonError } from '@/lib/api-response';
import { getIterationCount } from '@/lib/deployment-retention';

const DEPLOYMENT_COLUMNS = 'id, code, current_version_id, title, description, filename, file_path, file_size, qr_code_path, created_at, updated_at, view_count, status, expires_at';
const DEPLOYMENT_COLUMNS_WITH_LIKES = `${DEPLOYMENT_COLUMNS}, like_count`;
const VERSION_COUNT_COLUMNS = 'deployment_id';

function parseSort(sortBy: string | null, includeLikeCount = true) {
  switch (sortBy) {
    case 'oldest':
      return { column: 'created_at', ascending: true };
    case 'mostViewed':
      return { column: 'view_count', ascending: false };
    case 'leastViewed':
      return { column: 'view_count', ascending: true };
    case 'mostLiked':
      return includeLikeCount
        ? { column: 'like_count', ascending: false }
        : { column: 'created_at', ascending: false };
    case 'leastLiked':
      return includeLikeCount
        ? { column: 'like_count', ascending: true }
        : { column: 'created_at', ascending: false };
    case 'latest':
    default:
      return { column: 'created_at', ascending: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const pageSize = Math.min(60, Math.max(1, Number(params.get('pageSize') || 12)));
    const status = params.get('status');
    const keyword = (params.get('q') || '').trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const fetchDeployPage = async (includeLikeCount: boolean) => {
      const sortBy = parseSort(params.get('sortBy'), includeLikeCount);
      let query = supabase
        .from('deployments')
        .select(includeLikeCount ? DEPLOYMENT_COLUMNS_WITH_LIKES : DEPLOYMENT_COLUMNS, { count: 'exact' });

      if (status === 'active' || status === 'inactive') {
        query = query.eq('status', status);
      }

      if (keyword) {
        const escapedKeyword = keyword.replace(/,/g, '\\,').replace(/%/g, '\\%').replace(/_/g, '\\_');
        query = query.or(`title.ilike.%${escapedKeyword}%,description.ilike.%${escapedKeyword}%,filename.ilike.%${escapedKeyword}%,code.ilike.%${escapedKeyword}%`);
      }

      return query
        .order(sortBy.column, { ascending: sortBy.ascending })
        .range(from, to);
    };

    let includeLikeCount = true;
    let { data: deploys, error, count } = await fetchDeployPage(includeLikeCount);

    if (isMissingLikeCountError(error)) {
      includeLikeCount = false;
      ({ data: deploys, error, count } = await fetchDeployPage(includeLikeCount));
    }

    if (error) throw new Error(error.message);

    const deployRows = (deploys || []) as Partial<DeploymentRow>[];
    const deploymentIds = deployRows
      .map((deploy) => deploy.id)
      .filter((id): id is string => typeof id === 'string');
    const versionCounts = new Map<string, number>();

    if (deploymentIds.length > 0) {
      const { data: versionCountRows, error: versionCountError } = await supabase
        .from('deployment_versions')
        .select(VERSION_COUNT_COLUMNS)
        .in('deployment_id', deploymentIds);

      if (versionCountError) {
        console.error('Fetch deployment version counts error:', versionCountError);
      } else {
        for (const row of versionCountRows || []) {
          const deploymentId = String(row.deployment_id);
          versionCounts.set(deploymentId, (versionCounts.get(deploymentId) || 0) + 1);
        }
      }
    }

    const formattedDeploys = deployRows.map((deploy) =>
      mapDeploymentRow({
        ...deploy,
        like_count: includeLikeCount ? deploy.like_count ?? 0 : 0,
        version_count: getIterationCount(versionCounts.get(String(deploy.id))) + 1,
      } as DeploymentRow)
    );
    const total = count || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      deploys: formattedDeploys,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error: unknown) {
    console.error('Fetch deployments error:', error);
    return jsonError({
      status: 500,
      code: 'DEPLOYMENTS_FETCH_FAILED',
      message: '获取部署列表失败。',
      detail: getErrorMessage(error),
    });
  }
}
