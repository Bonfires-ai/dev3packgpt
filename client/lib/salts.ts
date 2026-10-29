// Server-side only. Each member chats with their own agent in the Salts fleet, as
// themselves: their Clerk OAuth access token (issued for the Salts resource) opens
// that agent's sessions, so no agent API key is held here.
import { findSaltsAgent } from '@/config/salts.config';
import { type Member, fleetAgents } from '@/lib/auth';
import { saltsAccessToken } from '@/lib/salts-tokens';
import { NextResponse } from 'next/server';

const SALTS_API_URL = process.env.SALTS_API_URL ?? 'https://api.salts.dev';

export interface SaltsAgentAuth {
  token: string;
  agentId: string;
}

/**
 * The member's fleet agent and a token to reach it, or the response to return as is.
 * `slug` is the chat the browser opened; it only has to be one this app offers.
 */
export async function memberAgentAuth(
  member: Member,
  slug: string | null | undefined
): Promise<SaltsAgentAuth | NextResponse> {
  if (!findSaltsAgent(slug)) return unknownAgent();
  try {
    const [agent] = await fleetAgents(member.email);
    if (!agent) return NextResponse.json({ error: 'You have no agent in this fleet.' }, { status: 403 });
    const token = await saltsAccessToken(member.email);
    if (!token) return NextResponse.json({ error: 'Sign in again to chat with your agent.' }, { status: 401 });
    return { token, agentId: agent.id };
  } catch (err) {
    console.error('salts agent lookup failed', err);
    return NextResponse.json({ error: 'Could not reach your agent. Please try again.' }, { status: 503 });
  }
}

/** Session ids are `<agentId>~<local>`, so the browser can only reach this agent's sessions. */
export const ownsSession = (auth: SaltsAgentAuth, sessionId: string) =>
  sessionId.startsWith(`${auth.agentId}~`) && /^[A-Za-z0-9~-]+$/.test(sessionId);

export function saltsFetch(auth: SaltsAgentAuth, path: string, init: RequestInit = {}) {
  return fetch(`${SALTS_API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...init.headers, Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
  });
}

export const unknownAgent = () => NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

/** Pass a Salts refusal on as `{ error }`, keeping its status. */
export async function upstreamError(res: Response) {
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ error: body.error ?? `Salts answered ${res.status}` }, { status: res.status });
}
