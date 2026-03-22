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
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const isPreview = request.nextUrl.searchParams.get('preview') === '1';
    
    // For preview mode (admin embed), allow inactive deployments too
    const query = supabase
      .from('deployments')
      .select('id, file_path, status')
      .eq('code', code);
    
    if (!isPreview) {
      query.eq('status', 'active');
    }
    
    const { data: deployment, error } = await query.single();

    if (error || !deployment) {
      return new NextResponse('Deployment not found or inactive', { status: 404 });
    }

    // Skip view count increment for embed/preview requests
    if (!isPreview) {
      // Do not block page response on stats write.
      void supabase
        .rpc('increment_deployment_view_count', { target_id: deployment.id })
        .then(({ error: incrementError }) => {
          if (incrementError) {
            console.error('Increment view count error:', incrementError);
          }
        });
    }

    const storagePath = getStoragePathFromFilePath(deployment.file_path, code);
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

  } catch (error: any) {
    console.error('Serve error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
