import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

function getStoragePathFromFilePath(filePath: unknown, code: string) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return `html/${code}.html`;
  }

  try {
    const parsed = new URL(filePath);
    const marker = '/deployments/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) {
      return `html/${code}.html`;
    }

    const resolvedPath = parsed.pathname.slice(index + marker.length);
    return resolvedPath || `html/${code}.html`;
  } catch {
    return `html/${code}.html`;
  }
}

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
      .select('id, file_path, view_count, status')
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
      const { error: incrementError } = await supabase
        .rpc('increment_deployment_view_count', { target_id: deployment.id });

      if (incrementError) {
        console.error('Increment view count error:', incrementError);
      }
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
        'Content-Type': 'text/html',
      },
    });

  } catch (error: any) {
    console.error('Serve error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
