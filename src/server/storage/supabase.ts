import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/server/errors';

let cachedClient: SupabaseClient | null = null;

export const DEPLOYMENTS_BUCKET = 'deployments';

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new AppError(
      500,
      'CONFIG_ERROR',
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
}
