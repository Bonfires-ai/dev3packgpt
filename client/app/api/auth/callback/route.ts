import {
  FLOW_COOKIE_NAME,
  POPUP_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  completeLogin,
  currentUser,
  popupHandoff,
  publicOrigin,
  sessionCookie,
  signSession,
} from '@/lib/auth';
import { saveSaltsTokens } from '@/lib/salts-tokens';
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
  // /api/wallet and /api/connection-details try again. Without saved Salts tokens the
  // text chat asks the member to sign in again; the rest still works.
  if (result.ok) {
    await ensureWalletKey(result.profile.email).catch(err => console.error('wallet provisioning failed', err));
    await saveSaltsTokens(result.profile.email, result.tokens).catch(err =>
      console.error('saving salts tokens failed', err)
    );
  }

  // Sign-in popup of the embedded widget: answer with a tiny page that hands the token
  // to the iframe and closes, instead of loading the app in the popup first.
  if (cookies().get(POPUP_COOKIE_NAME)?.value) {
    const token = result.ok
      ? await signSession(result.profile)
      : (await currentUser()) // a repeated callback: the first one already signed in
        ? cookies().get(SESSION_COOKIE_NAME)?.value
        : undefined;
    const page = popupHandoff(token, result.ok ? undefined : result.error);
    if (result.ok && token) page.cookies.set(sessionCookie(token));
    page.cookies.delete(FLOW_COOKIE_NAME);
    return page;
  }

  const target = new URL(result.returnTo, origin);
  if (!result.ok) target.searchParams.set('auth_error', result.error);
  const res = NextResponse.redirect(target);
  res.cookies.delete(FLOW_COOKIE_NAME);
  if (result.ok) res.cookies.set(sessionCookie(await signSession(result.profile)));
  return res;
}
