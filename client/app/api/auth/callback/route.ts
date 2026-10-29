import { FLOW_COOKIE_NAME, completeLogin, publicOrigin, sessionCookie, signSession } from '@/lib/auth';
import { ensureWalletKey } from '@/lib/wallet';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Clerk redirects here after login. Fleet members get a session cookie; anyone
// else goes back with ?auth_error=<reason> for the page to explain.
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const flow = cookies().get(FLOW_COOKIE_NAME)?.value;
  const result = await completeLogin(origin, new URL(request.url).searchParams, flow).catch(err => {
    console.error('sign-in failed', err);
    return { ok: false as const, error: 'failed', returnTo: '/' };
  });

  // A member's OpenRouter key is made on joining. Sign-in does not wait on a failure:
  // /api/wallet and /api/connection-details try again.
  if (result.ok) {
    await ensureWalletKey(result.profile.email).catch(err => console.error('wallet provisioning failed', err));
  }

  const target = new URL(result.returnTo, origin);
  if (!result.ok) target.searchParams.set('auth_error', result.error);
  const res = NextResponse.redirect(target);
  res.cookies.delete(FLOW_COOKIE_NAME);
  if (result.ok) res.cookies.set(sessionCookie(await signSession(result.profile)));
  return res;
}
