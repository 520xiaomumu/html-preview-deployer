import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getStoragePathFromFilePath } from '@/lib/storage';
import {
  buildEdgeHtmlUrl,
  htmlServeViaEdge,
  isPubliclyVisible,
  planVersionServe,
  revisionFromStoragePath,
} from '@/lib/html-origin';
import { scheduleDeploymentViewCount } from '@/lib/schedule-view-count';
import { cachedEdgeRedirect, noStoreRedirect, proxyStoredHtml } from '@/lib/serve-html';

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

    const storagePath = getStoragePathFromFilePath(selectedVersion.file_path, code);
    const expectedRevision = revisionFromStoragePath(storagePath, selectedVersion.id);
    const plan = planVersionServe({
      isPreview,
      revision,
      expectedRevision,
      publiclyVisible: isPubliclyVisible(deployment.status, selectedVersion.status),
      serveViaEdge: htmlServeViaEdge(),
    });

    if (plan.kind === 'redirect-revision') {
      if (plan.countView) {
        scheduleDeploymentViewCount(deployment.id);
      }
      const destination = new URL(request.url);
      destination.searchParams.delete('preview');
      destination.searchParams.set('rev', plan.revision);
      return noStoreRedirect(destination);
    }

    let servePreview = false;
    if (plan.kind === 'redirect-edge') {
      servePreview = plan.preview;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        const edgeUrl = buildEdgeHtmlUrl({
          supabaseUrl,
          code,
          version: versionNumber,
          revision: plan.revision,
          preview: plan.preview,
        });
        return plan.cacheable ? cachedEdgeRedirect(edgeUrl) : noStoreRedirect(edgeUrl);
      }
    } else {
      servePreview = plan.preview;
    }

    return proxyStoredHtml(storagePath, servePreview, 'version');
  } catch (error: unknown) {
    console.error('Serve version error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
