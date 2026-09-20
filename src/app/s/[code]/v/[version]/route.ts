import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { htmlResponse } from '@/lib/api-response';
import { getStoragePathFromFilePath } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; version: string }> }
) {
  try {
    const { code, version } = await params;
    const isPreview = request.nextUrl.searchParams.get('preview') === '1';
    const revision = request.nextUrl.searchParams.get('rev');
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
      .select('id, file_path, status')
      .eq('deployment_id', deployment.id)
      .eq('version_number', versionNumber)
      .maybeSingle();

    if (versionError || !selectedVersion || (!isPreview && selectedVersion.status === 'inactive')) {
      return new NextResponse('Deployment version not found', { status: 404 });
    }

    const expectedRevision = getStoragePathFromFilePath(selectedVersion.file_path, code).split('/').pop()
      || selectedVersion.id;

    if (!isPreview && revision !== expectedRevision) {
      const { error: incrementError } = await supabase
        .rpc('increment_deployment_view_count', { target_id: deployment.id });
      if (incrementError) console.error('Increment view count error:', incrementError);

      const destination = new URL(request.url);
      destination.searchParams.set('rev', expectedRevision);
      return NextResponse.redirect(destination, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
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

    return htmlResponse(content, isPreview, undefined, 'version');
  } catch (error: unknown) {
    console.error('Serve version error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
