// Server-side only: reads the agent keys from the environment.
import { findSaltsAgent } from '@/config/salts.config';
import { NextResponse } from 'next/server';

const SALTS_API_URL = process.env.SALTS_API_URL ?? 'https://api.salts.dev';

// A Salts agent key is `salt_<role>_<agentId>_<secret>`; the agent id is in the key.
const KEY_PATTERN = /^salt_(?:user|admin)_([A-Za-z0-9-]+)_[A-Za-z0-9]{32,}$/;

export interface SaltsAgentAuth {
  key: string;
  agentId: string;
}

/** The key and agent id for a configured agent, or null if it is unknown or has no key. */
export function saltsAgentAuth(slug: string | null | undefined): SaltsAgentAuth | null {
  const agent = findSaltsAgent(slug);
  if (!agent) return null;
  const key = process.env[`SALTS_AGENT_KEY_${agent.slug.toUpperCase().replace(/-/g, '_')}`];
  const agentId = key?.match(KEY_PATTERN)?.[1];
  return key && agentId ? { key, agentId } : null;
}

/** Session ids are `<agentId>~<local>`, so the browser can only reach this agent's sessions. */
export const ownsSession = (auth: SaltsAgentAuth, sessionId: string) =>
  sessionId.startsWith(`${auth.agentId}~`) && /^[A-Za-z0-9~-]+$/.test(sessionId);

export function saltsFetch(auth: SaltsAgentAuth, path: string, init: RequestInit = {}) {
  return fetch(`${SALTS_API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...init.headers, Authorization: `Bearer ${auth.key}`, 'Content-Type': 'application/json' },
  });
}

export const unknownAgent = () => NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

/** Pass a Salts refusal on as `{ error }`, keeping its status. */
export async function upstreamError(res: Response) {
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ error: body.error ?? `Salts answered ${res.status}` }, { status: res.status });
}
