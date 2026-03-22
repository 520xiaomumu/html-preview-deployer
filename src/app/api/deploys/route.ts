import { NextRequest, NextResponse } from 'next/server';
import { DeploymentRow, supabase } from '@/lib/db';
import { mapDeploymentRow } from '@/lib/deployment-mapper';

function parseSort(sortBy: string | null) {
  switch (sortBy) {
    case 'oldest':
      return { column: 'created_at', ascending: true };
    case 'mostViewed':
      return { column: 'view_count', ascending: false };
    case 'leastViewed':
      return { column: 'view_count', ascending: true };
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
    const sortBy = parseSort(params.get('sortBy'));

    let query = supabase
      .from('deployments')
      .select(
        'id, code, title, filename, file_path, file_size, qr_code_path, created_at, updated_at, view_count, status',
        { count: 'exact' }
      );

    if (status === 'active' || status === 'inactive') {
      query = query.eq('status', status);
    }

    if (keyword) {
      const escapedKeyword = keyword.replace(/,/g, '\\,').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`title.ilike.%${escapedKeyword}%,filename.ilike.%${escapedKeyword}%,code.ilike.%${escapedKeyword}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: deploys, error, count } = await query
      .order(sortBy.column, { ascending: sortBy.ascending })
      .range(from, to);

    if (error) throw new Error(error.message);

    const formattedDeploys = (deploys || []).map((deploy) => mapDeploymentRow(deploy as DeploymentRow));
    const total = count || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      deploys: formattedDeploys,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error: any) {
    console.error('Fetch deployments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
