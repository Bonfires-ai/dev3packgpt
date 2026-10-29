import { requireMember } from '@/lib/auth';
import { memberAgentAuth, ownsSession, saltsFetch, unknownAgent, upstreamError } from '@/lib/salts';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Destroys the session and everything in it once the chat ends.
export async function DELETE(request: Request, { params }: { params: { sessionId: string } }) {
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  const auth = await memberAgentAuth(member, new URL(request.url).searchParams.get('agent'));
  if (auth instanceof NextResponse) return auth;
  if (!ownsSession(auth, params.sessionId)) return unknownAgent();

  const res = await saltsFetch(auth, `/api/sessions/${encodeURIComponent(params.sessionId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) return upstreamError(res);
  return NextResponse.json({ ok: true });
}
