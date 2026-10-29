import { saltsAgentAuth, saltsFetch, unknownAgent, upstreamError } from '@/lib/salts';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Starts one Salts session for a text chat. The browser deletes it when the
// chat ends (DELETE /api/salts/sessions/<id>).
export async function POST(request: Request) {
  const { agent } = await request.json().catch(() => ({}));
  const auth = saltsAgentAuth(agent);
  if (!auth) return unknownAgent();

  const res = await saltsFetch(auth, `/api/agents/${auth.agentId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title: `Solène web chat ${new Date().toISOString()}` }),
  });
  if (!res.ok) return upstreamError(res);
  const session = await res.json();
  return NextResponse.json({ sessionId: session.id }, { headers: { 'Cache-Control': 'no-store' } });
}
