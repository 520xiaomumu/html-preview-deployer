import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@/server/errors';
import { getSupabaseAdmin } from '@/server/storage/supabase';
import { AgentKey, AgentKeyRow, CreatedAgentKey } from '@/server/agent-keys/types';

function mapAgentKey(row: AgentKeyRow): AgentKey {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export function hashAgentToken(token: string) {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function createAgentToken() {
  return `htm_${randomBytes(24).toString('base64url')}`;
}

export async function createAgentKey(ownerId: string, name: unknown): Promise<CreatedAgentKey> {
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'name must be a non-empty string.');
  }

  const token = createAgentToken();
  const keyPrefix = token.slice(0, 12);
  const { data, error } = await getSupabaseAdmin()
    .from('agent_keys')
    .insert({
      owner_id: ownerId,
      name: name.trim(),
      key_prefix: keyPrefix,
      key_hash: hashAgentToken(token),
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to create agent key.', error?.message);
  }

  return {
    ...mapAgentKey(data as AgentKeyRow),
    token,
  };
}

export async function listAgentKeys(ownerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_keys')
    .select('id, owner_id, name, key_prefix, is_active, last_used_at, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to list agent keys.', error.message);
  }

  return (data || []).map((row) => mapAgentKey(row as AgentKeyRow));
}

export async function revokeAgentKey(ownerId: string, id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_keys')
    .update({ is_active: false })
    .eq('owner_id', ownerId)
    .eq('id', id)
    .select('id, owner_id, name, key_prefix, is_active, last_used_at, created_at')
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to revoke agent key.', error.message);
  }

  if (!data) {
    throw new AppError(404, 'AGENT_KEY_NOT_FOUND', 'Agent key not found.');
  }

  return mapAgentKey(data as AgentKeyRow);
}

export async function findActiveAgentByToken(token: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_keys')
    .select('id, owner_id, name, key_prefix, is_active, last_used_at, created_at')
    .eq('key_hash', hashAgentToken(token))
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to authenticate agent key.', error.message);
  }

  if (!data) return null;

  void getSupabaseAdmin()
    .from('agent_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return mapAgentKey(data as AgentKeyRow);
}
