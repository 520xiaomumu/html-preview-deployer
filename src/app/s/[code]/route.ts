import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getStoragePathFromFilePath } from '@/lib/storage';
import { DeploymentVersionRow } from '@/lib/db';
import { selectPrimaryVersion } from '@/lib/version-selection';
import { isPubliclyVisible, revisionFromStoragePath } from '@/lib/html-origin';
import { scheduleDeploymentViewCount } from '@/lib/schedule-view-count';
import { noStoreRedirect, proxyStoredHtml } from '@/lib/serve-html';

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

    if (
      primaryVersion
      && (!isPreview || isPubliclyVisible(deployment.status, primaryVersion.status))
    ) {
      const storagePath = getStoragePathFromFilePath(primaryVersion.file_path, code);
      const revision = revisionFromStoragePath(storagePath, primaryVersion.id);
      const destination = new URL(`/s/${code}/v/${primaryVersion.version_number}`, request.url);
      destination.searchParams.set('rev', revision);

      if (!isPreview) {
        scheduleDeploymentViewCount(deployment.id);
      }

      return noStoreRedirect(destination);
    }

    const storagePath = getStoragePathFromFilePath(primaryVersion?.file_path || deployment.file_path, code);
    return proxyStoredHtml(storagePath, isPreview, 'current');
  } catch (error: unknown) {
    console.error('Serve error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
