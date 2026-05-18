export const UNPRESERVED_DEPLOYMENT_TTL_HOURS = 24;

export function getNewDeploymentExpiresAt(now = Date.now()) {
  return new Date(now + UNPRESERVED_DEPLOYMENT_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export function getIterationCount(versionCount: number | null | undefined) {
  return Math.max(Number(versionCount ?? 1) - 1, 0);
}
