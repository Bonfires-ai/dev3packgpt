import { requireMember } from '@/lib/auth';
import { memberAgentAuth, saltsFetch, upstreamError } from '@/lib/salts';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Starts one Salts session for a text chat. The browser deletes it when the
// chat ends (DELETE /api/salts/sessions/<id>).
export async function POST(request: Request) {
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  const { agent } = await request.json().catch(() => ({}));
  const auth = await memberAgentAuth(member, agent);
  if (auth instanceof NextResponse) return auth;

  const res = await saltsFetch(auth, `/api/agents/${auth.agentId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title: `Solène web chat ${new Date().toISOString()}` }),
  });
  if (!res.ok) return upstreamError(res);
  const session = await res.json();
  return NextResponse.json({ sessionId: session.id }, { headers: { 'Cache-Control': 'no-store' } });
}
