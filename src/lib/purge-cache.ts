import { addCacheTag, dangerouslyDeleteByTag } from '@vercel/functions';
import { DEPLOY_LIST_CACHE_TAG, SHORT_CODE_PATTERN } from '@/lib/deploy-config';
import { shortLinkCacheTag } from '@/lib/short-link-cache';

export async function tagCachedResponse(tag: string | string[]) {
  try {
    await addCacheTag(tag);
  } catch (error) {
    console.error('Add cache tag failed:', error);
  }
}

export async function purgePublishedPageFromResult(result: {
  status: number;
  json?: Record<string, unknown>;
}) {
  if (result.status < 200 || result.status >= 300) return;
  const code = result.json?.code;
  if (typeof code !== 'string') return;
  await purgePublishedPage(code);
}

// Deletes the short-link redirect and the homepage list. Outside the Vercel
// runtime this is a no-op, so local tests and `next dev` keep working.
export async function purgePublishedPage(code: string | null | undefined) {
  const normalized = (code || '').trim().toLowerCase();
  if (!SHORT_CODE_PATTERN.test(normalized)) return;

  try {
    await dangerouslyDeleteByTag([shortLinkCacheTag(normalized), DEPLOY_LIST_CACHE_TAG]);
  } catch (error) {
    console.error('Purge published page failed:', error);
  }
}
