import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getStoragePathFromFilePath } from '@/lib/storage';
import { DeploymentVersionRow } from '@/lib/db';
import { selectPrimaryVersion } from '@/lib/version-selection';
import { isPubliclyVisible, revisionFromStoragePath } from '@/lib/html-origin';
import { scheduleDeploymentViewCount } from '@/lib/schedule-view-count';
import { tagCachedResponse } from '@/lib/purge-cache';
import {
  CANONICAL_SHORT_LINK_EDGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  SHORT_LINK_CACHE_CONTROL,
} from '@/lib/deploy-config';
import { canonicalShortLinkTarget, shortLinkCacheTag } from '@/lib/short-link-cache';
import { cachedPreviewRedirect, cachedRedirect, cachedShortLinkRedirect, proxyStoredHtml } from '@/lib/serve-html';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const canonical = canonicalShortLinkTarget(request.url, code);
    if (canonical) {
      const preview = canonical.includes('preview=1');
      return cachedRedirect(
        canonical,
        SHORT_LINK_CACHE_CONTROL,
        CANONICAL_SHORT_LINK_EDGE_CACHE_CONTROL,
        preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : undefined,
      );
    }

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
      const headers: Record<string, string> = { 'Cache-Control': NO_STORE_CACHE_CONTROL };
      if (isPreview) headers['X-Robots-Tag'] = 'noindex, nofollow';
      return new NextResponse('Deployment not found or inactive', { status: 404, headers });
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

      // The CDN keeps this redirect for 60s (15 min for ?preview=1). A repeat
      // visit in that window does not run this function, so view_count
      // increments once per fill per region rather than once per visitor.
      // Likes, publishes, and strategy changes delete the tag and the next
      // visit counts again.
      await tagCachedResponse(shortLinkCacheTag(code));
      if (!isPreview) {
        scheduleDeploymentViewCount(deployment.id);
        return cachedShortLinkRedirect(destination, code);
      }

      return cachedPreviewRedirect(destination, code);
    }

    const storagePath = getStoragePathFromFilePath(primaryVersion?.file_path || deployment.file_path, code);
    return proxyStoredHtml(storagePath, isPreview, 'current');
  } catch (error: unknown) {
    console.error('Serve error:', error);
    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL },
    });
  }
}
