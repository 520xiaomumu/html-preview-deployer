import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { htmlResponse } from '@/lib/api-response';
import { getStoragePathFromFilePath } from '@/lib/storage';
import { DeploymentVersionRow } from '@/lib/db';
import { selectPrimaryVersion } from '@/lib/version-selection';

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
      .select('id, file_path, status, current_version_id, primary_version_strategy')
      .eq('code', code);
    
    if (!isPreview) {
      query.eq('status', 'active');
    }
    
    const { data: deployment, error } = await query.single();

    if (error || !deployment) {
      return new NextResponse('Deployment not found or inactive', { status: 404 });
    }

    const { data: versions, error: versionsError } = await supabase
      .from('deployment_versions')
      .select('id, version_number, file_path, like_count, status')
      .eq('deployment_id', deployment.id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('Fetch versions error:', versionsError);
    }

    const primaryVersion = selectPrimaryVersion(
      (versions || []) as DeploymentVersionRow[],
      deployment.current_version_id,
      deployment.primary_version_strategy || 'likes',
    );

    if (!isPreview && primaryVersion) {
      const { error: incrementError } = await supabase
        .rpc('increment_deployment_view_count', { target_id: deployment.id });
      if (incrementError) console.error('Increment view count error:', incrementError);

      const destination = new URL(`/s/${code}/v/${primaryVersion.version_number}`, request.url);
      destination.searchParams.set(
        'rev',
        getStoragePathFromFilePath(primaryVersion.file_path, code).split('/').pop() || primaryVersion.id,
      );
      return NextResponse.redirect(destination, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const storagePath = getStoragePathFromFilePath(primaryVersion?.file_path || deployment.file_path, code);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('deployments')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new NextResponse('File content not found', { status: 404 });
    }

    const content = await fileData.text();

    return htmlResponse(content, isPreview);

  } catch (error: unknown) {
    console.error('Serve error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
