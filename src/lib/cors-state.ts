import { supabase } from '@/lib/db';

const CORS_SETTING_KEY = 'cors_enabled';
const CACHE_TTL_MS = 5000;

let cachedCorsState: { enabled: boolean; expiresAt: number } | null = null;

function readEnabled(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as { enabled?: unknown }).enabled === true;
  }
  return false;
}

export async function isCorsEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedCorsState && cachedCorsState.expiresAt > now) {
    return cachedCorsState.enabled;
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', CORS_SETTING_KEY)
    .maybeSingle();

  if (error) {
    console.error('Read CORS setting failed:', error);
    return false;
  }

  const enabled = readEnabled(data?.value);
  cachedCorsState = { enabled, expiresAt: now + CACHE_TTL_MS };
  return enabled;
}

export async function setCorsEnabled(value: boolean): Promise<boolean> {
  const enabled = Boolean(value);
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: CORS_SETTING_KEY,
      value: { enabled },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    throw new Error(error.message);
  }

  cachedCorsState = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
  return enabled;
}
