import { ownsSession, saltsAgentAuth, saltsFetch, unknownAgent, upstreamError } from '@/lib/salts';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Sends one message and passes the Salts reply stream (SSE: delta, tool,
// tool_done, usage, error, done) straight through to the browser.
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const { agent, message } = await request.json().catch(() => ({}));
  const auth = saltsAgentAuth(agent);
  if (!auth || !ownsSession(auth, params.sessionId)) return unknownAgent();
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }

  const res = await saltsFetch(auth, `/agents/session-agent/${encodeURIComponent(params.sessionId)}/stream`, {
    method: 'POST',
    body: JSON.stringify({ message }),
    signal: request.signal,
  });
  if (!res.ok || !res.body) return upstreamError(res);
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' },
  });
}
