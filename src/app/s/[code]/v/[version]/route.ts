import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import {
  CDN_CACHE_CONTROL,
  CDN_EDGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
} from '@/lib/deploy-config';
import { getStoragePathFromFilePath } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> }
) {
  try {
    const { code, version } = await params;
    const isPreview = request.nextUrl.searchParams.get('preview') === '1';
    const versionNumber = Number(version);

    if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
      return new NextResponse('Invalid version', { status: 400 });
    }

    const query = supabase
      .from('deployments')
      .select('id, status')
      .eq('code', code);

    if (!isPreview) {
      query.eq('status', 'active');
    }

    const { data: deployment, error: deploymentError } = await query.single();

    if (deploymentError || !deployment) {
      return new NextResponse('Deployment not found or inactive', { status: 404 });
    }

    const { data: selectedVersion, error: versionError } = await supabase
      .from('deployment_versions')
      .select('file_path')
      .eq('deployment_id', deployment.id)
      .eq('version_number', versionNumber)
      .maybeSingle();

    if (versionError || !selectedVersion) {
      return new NextResponse('Deployment version not found', { status: 404 });
    }

    if (!isPreview) {
      void supabase
        .rpc('increment_deployment_view_count', { target_id: deployment.id })
        .then(({ error: incrementError }) => {
          if (incrementError) {
            console.error('Increment view count error:', incrementError);
          }
        });
    }

    const storagePath = getStoragePathFromFilePath(selectedVersion.file_path, code);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('deployments')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new NextResponse('File content not found', { status: 404 });
    }

    const content = await fileData.text();

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': isPreview ? NO_STORE_CACHE_CONTROL : CDN_CACHE_CONTROL,
        ...(isPreview
          ? {}
          : {
              'CDN-Cache-Control': CDN_EDGE_CACHE_CONTROL,
              'Vercel-CDN-Cache-Control': CDN_EDGE_CACHE_CONTROL,
            }),
      },
    });
  } catch (error: unknown) {
    console.error('Serve version error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
