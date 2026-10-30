import { findSaltsAgent } from '@/config/salts.config';
import { requireMember } from '@/lib/auth';
import { memberAgentAuth, ownsSession, saltsFetch, unknownAgent, upstreamError } from '@/lib/salts';
import { ensureWalletKey } from '@/lib/wallet';
import { AgentMoodEnum } from '@/types/agent';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Sends one message and passes the Salts reply stream (SSE: delta, tool,
// tool_done, usage, error, done) straight through to the browser. The message is
// paid with the member's own OpenRouter wallet key (Salts' x-openrouter-key), never
// the fleet agent's: without the wallet key it is not sent at all. Only the MCP
// server for the chat's language is offered (Salts' x-mcp-servers), never both.
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  const { agent, message, mood } = await request.json().catch(() => ({}));
  const auth = await memberAgentAuth(member, agent);
  if (auth instanceof NextResponse) return auth;
  if (!ownsSession(auth, params.sessionId)) return unknownAgent();
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }

  let walletKey: string;
  try {
    walletKey = await ensureWalletKey(member.email);
  } catch (err) {
    console.error('wallet key unavailable', err);
    return NextResponse.json({ error: 'Your credit could not be loaded. Please try again.' }, { status: 503 });
  }

  const res = await saltsFetch(auth, `/agents/session-agent/${encodeURIComponent(params.sessionId)}/stream`, {
    method: 'POST',
    headers: {
      'X-OpenRouter-Key': walletKey,
      'X-MCP-Servers':
        findSaltsAgent(agent)!.mcpServer[
          mood === AgentMoodEnum.SPANISH ? AgentMoodEnum.SPANISH : AgentMoodEnum.ENGLISH
        ],
    },
    body: JSON.stringify({ message }),
    signal: request.signal,
  });
  if (!res.ok || !res.body) return upstreamError(res);
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' },
  });
}
