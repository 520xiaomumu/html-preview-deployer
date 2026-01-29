import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    // Check if deployment exists and is active
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('id, file_path, view_count')
      .eq('code', code)
      .eq('status', 'active')
      .single();

    if (error || !deployment) {
      return new NextResponse('Deployment not found or inactive', { status: 404 });
    }

    // Increment view count (Optimistic, non-atomic)
    await supabase
      .from('deployments')
      .update({ view_count: (deployment.view_count || 0) + 1 })
      .eq('id', deployment.id);

    // Download file content from Storage
    // The file_path in DB is the public URL, e.g. https://.../html/code.html
    // We can just download it using fetch, OR use storage download if we know the path.
    // We stored it as `html/${code}.html`.
    
    const storagePath = `html/${code}.html`;
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
