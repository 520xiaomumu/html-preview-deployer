export type AgentKeyRow = {
  id: string;
  owner_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export type AgentKey = {
  id: string;
  ownerId: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export type CreatedAgentKey = AgentKey & {
  token: string;
};
