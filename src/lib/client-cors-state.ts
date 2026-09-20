'use client';

let cached: { enabled: boolean; expiresAt: number } | null = null;
let pending: Promise<boolean> | null = null;

export function fetchCorsState(force = false) {
  if (!force && cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.enabled);
  }
  if (pending) return pending;

  pending = fetch('/api/cors')
    .then((response) => response.json())
    .then((data) => {
      const enabled = data?.enabled === true;
      cached = { enabled, expiresAt: Date.now() + 60_000 };
      return enabled;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export function cacheCorsState(enabled: boolean) {
  cached = { enabled, expiresAt: Date.now() + 60_000 };
}
