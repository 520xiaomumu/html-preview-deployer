import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@/server/errors';
import { findActiveAgentByToken } from '@/server/agent-keys/service';

export type Actor = {
  id: string;
  ownerId: string;
  agentKeyId: string | null;
  authenticated: boolean;
  mode: 'agent-key' | 'env-key' | 'dev';
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function readBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : request.headers.get('x-htmlteam-key') || '';
}

export async function resolveActor(request: Request): Promise<Actor | null> {
  const configuredKey = process.env.HTMLTEAM_API_KEY;
  const token = readBearerToken(request);

  if (configuredKey) {
    if (!token) return null;

    if (safeEqual(token, configuredKey)) {
      return {
        id: 'env-key',
        ownerId: process.env.HTMLTEAM_OWNER_ID || 'admin',
        agentKeyId: null,
        authenticated: true,
        mode: 'env-key',
      };
    }

    const agent = await findActiveAgentByToken(token);
    if (agent) {
      return {
        id: agent.id,
        ownerId: agent.ownerId,
        agentKeyId: agent.id,
        authenticated: true,
        mode: 'agent-key',
      };
    }

    throw new AppError(403, 'FORBIDDEN', 'Invalid API token.');
  }

  if (token) {
    const agent = await findActiveAgentByToken(token);
    if (agent) {
      return {
        id: agent.id,
        ownerId: agent.ownerId,
        agentKeyId: agent.id,
        authenticated: true,
        mode: 'agent-key',
      };
    }
    throw new AppError(403, 'FORBIDDEN', 'Invalid API token.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new AppError(500, 'CONFIG_ERROR', 'HTMLTEAM_API_KEY is required in production.');
  }

  return {
    id: 'local-dev',
    ownerId: process.env.HTMLTEAM_OWNER_ID || 'admin',
    agentKeyId: null,
    authenticated: true,
    mode: 'dev',
  };
}

export async function requireActor(request: Request): Promise<Actor> {
  const actor = await resolveActor(request);
  if (!actor) throw new AppError(401, 'AUTH_REQUIRED', 'Missing API token.');
  return actor;
}
