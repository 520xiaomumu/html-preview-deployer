import { DeploymentVersionRow } from '@/lib/db';

type PrimaryVersionCandidate = Pick<DeploymentVersionRow, 'id' | 'version_number' | 'like_count' | 'status'>;
export type PrimaryVersionStrategy = 'likes' | 'latest';

export function selectPrimaryVersion<T extends PrimaryVersionCandidate>(
  versions: T[],
  currentVersionId?: string | null,
  strategy: PrimaryVersionStrategy = 'likes',
) {
  const activeVersions = versions
    .filter((version) => (version.status || 'active') === 'active')
    .sort((a, b) => Number(b.version_number ?? 0) - Number(a.version_number ?? 0));

  if (strategy === 'latest') {
    return activeVersions[0] || null;
  }

  const likedVersions = activeVersions
    .filter((version) => Number(version.like_count ?? 0) > 0)
    .sort((a, b) => {
      const likeDiff = Number(b.like_count ?? 0) - Number(a.like_count ?? 0);
      return likeDiff || Number(b.version_number ?? 0) - Number(a.version_number ?? 0);
    });

  return likedVersions[0]
    || activeVersions.find((version) => version.id === currentVersionId)
    || activeVersions[0]
    || null;
}
