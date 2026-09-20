import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';

const BUCKET_NAME = 'deployments';
const CANDIDATE_PAGE_SIZE = 500;
const STORAGE_BATCH_SIZE = 100;
const DATABASE_BATCH_SIZE = 100;

type CleanupCandidate = {
  id: string;
  code: string;
  file_paths: string[] | null;
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAuthorized(request: Request) {
  const expectedSecret = Deno.env.get('CLEANUP_SECRET') || Deno.env.get('CRON_SECRET');
  const bearerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const providedSecret = request.headers.get('x-cleanup-secret') || bearerSecret;
  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

function getStoragePath(filePath: unknown, code: string) {
  const fallback = `html/${code}.html`;
  if (typeof filePath !== 'string' || !filePath.trim()) return fallback;

  try {
    const parsed = new URL(filePath);
    const marker = '/deployments/';
    const index = parsed.pathname.indexOf(marker);
    return index === -1 ? fallback : parsed.pathname.slice(index + marker.length) || fallback;
  } catch {
    return fallback;
  }
}

function getBeijingYesterdayStart(now = new Date()) {
  const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate() - 1,
  ) - 8 * 60 * 60 * 1000);
}

function chunks<T>(items: T[], size: number) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  if (!isAuthorized(request)) {
    return jsonResponse({ success: false, error: 'Invalid cleanup authorization.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Missing Supabase environment variables.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const url = new URL(request.url);
    const body = request.method === 'POST'
      ? await request.json().catch(() => ({})) as { dryRun?: boolean }
      : {};
    const dryRun = url.searchParams.get('dryRun') === '1' || body.dryRun === true;
    const cutoff = getBeijingYesterdayStart();
    let afterId: string | null = null;
    let checked = 0;
    let deletedCount = 0;
    const failed: Array<{ ids: string[]; error: string }> = [];
    const bucket = supabase.storage.from(BUCKET_NAME);

    while (true) {
      const { data, error } = await supabase.rpc('get_cleanup_candidates', {
        cutoff: cutoff.toISOString(),
        after_id: afterId,
        page_size: CANDIDATE_PAGE_SIZE,
      });
      if (error) throw new Error(error.message);
      if (!data?.length) break;

      const candidates = data as CleanupCandidate[];
      afterId = candidates[candidates.length - 1].id;
      checked += candidates.length;

      if (!dryRun) {
        const ids = candidates.map(({ id }) => id);
        const paths = Array.from(new Set(candidates.flatMap(({ code, file_paths }) => [
          ...(file_paths || []).map((path) => getStoragePath(path, code)),
          `html/${code}.html`,
          `qrcodes/${code}.png`,
        ])));

        try {
          for (const storagePaths of chunks(paths, STORAGE_BATCH_SIZE)) {
            const { error: storageError } = await bucket.remove(storagePaths);
            if (storageError) throw new Error(storageError.message);
          }
          for (const deploymentIds of chunks(ids, DATABASE_BATCH_SIZE)) {
            const { data: deleted, error: deleteError } = await supabase
              .from('deployments')
              .delete()
              .in('id', deploymentIds)
              .select('id');
            if (deleteError) throw new Error(deleteError.message);
            deletedCount += deleted?.length || 0;
          }
        } catch (error) {
          failed.push({ ids, error: getErrorMessage(error) });
        }
      }

      if (candidates.length < CANDIDATE_PAGE_SIZE) break;
    }

    console.log('cleanup-unpreserved-deployments', {
      dryRun,
      cutoff: cutoff.toISOString(),
      checked,
      deletedCount,
      failedCount: failed.length,
    });

    return jsonResponse({
      success: true,
      dryRun,
      cutoff: cutoff.toISOString(),
      checked,
      deletedCount,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Cleanup failed.',
      detail: getErrorMessage(error),
    }, 500);
  }
});
