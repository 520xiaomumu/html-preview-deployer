export type VersionServePlan =
  | { kind: 'redirect-revision'; countView: boolean; revision: string }
  | { kind: 'redirect-edge'; preview: boolean; cacheable: boolean; revision: string }
  | { kind: 'proxy'; preview: boolean; cacheable: boolean };

const EDGE_FUNCTION_NAME = 'serve-deployment-html';

export function revisionFromStoragePath(storagePath: string, fallbackId?: string | null) {
  const name = storagePath.split('/').pop();
  return name || fallbackId || 'file';
}

export function isPubliclyVisible(
  deploymentStatus: string | null | undefined,
  versionStatus: string | null | undefined,
) {
  return deploymentStatus === 'active' && (versionStatus || 'active') !== 'inactive';
}

export function htmlServeViaEdge(env: Record<string, string | undefined> = process.env) {
  return (env.HTML_SERVE_VIA || '').trim().toLowerCase() === 'edge';
}

export function buildEdgeHtmlUrl(options: {
  supabaseUrl: string;
  code: string;
  version: number;
  revision: string;
  preview?: boolean;
}) {
  const base = options.supabaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}/functions/v1/${EDGE_FUNCTION_NAME}`);
  url.searchParams.set('code', options.code);
  url.searchParams.set('version', String(options.version));
  url.searchParams.set('rev', options.revision);
  if (options.preview) {
    url.searchParams.set('preview', '1');
  }
  return url;
}

export function planVersionServe(input: {
  isPreview: boolean;
  revision: string | null;
  expectedRevision: string;
  publiclyVisible: boolean;
  serveViaEdge: boolean;
}): VersionServePlan {
  if (!input.publiclyVisible) {
    if (input.serveViaEdge) {
      return {
        kind: 'redirect-edge',
        preview: true,
        cacheable: false,
        revision: input.expectedRevision,
      };
    }
    return { kind: 'proxy', preview: true, cacheable: false };
  }

  if (input.revision !== input.expectedRevision) {
    return {
      kind: 'redirect-revision',
      countView: !input.isPreview,
      revision: input.expectedRevision,
    };
  }

  if (input.serveViaEdge) {
    return {
      kind: 'redirect-edge',
      preview: false,
      cacheable: true,
      revision: input.expectedRevision,
    };
  }

  return { kind: 'proxy', preview: false, cacheable: true };
}
