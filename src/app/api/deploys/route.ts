import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { data: deploys, error } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Map snake_case to camelCase for frontend compatibility
    const formattedDeploys = deploys.map(deploy => ({
      id: deploy.id,
      code: deploy.code,
      title: deploy.title,
      filename: deploy.filename,
      filePath: deploy.file_path,
      qrCodePath: deploy.qr_code_path,
      createdAt: deploy.created_at,
      updatedAt: deploy.updated_at,
      viewCount: deploy.view_count,
      status: deploy.status
    }));

    return NextResponse.json({
      deploys: formattedDeploys,
      total: formattedDeploys.length
    });
  } catch (error: any) {
    console.error('Fetch deployments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
