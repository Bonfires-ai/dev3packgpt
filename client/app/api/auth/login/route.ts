import { POPUP_COOKIE_NAME, beginLogin, clientId, flowCookie, publicOrigin, safeReturnTo } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Sends the browser to the Salts Clerk login; it comes back to /api/auth/callback.
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'));

  // Clerk fetches a URL client id over https, so an http one (local dev without
  // CLERK_OAUTH_CLIENT_ID) can only end on Clerk's "client does not exist" page.
  if (clientId(origin).startsWith('http://')) {
    console.error('sign-in: client id is not https; set CLERK_OAUTH_CLIENT_ID (see .env.example)');
    const back = new URL(returnTo, origin);
    back.searchParams.set('auth_error', 'not_configured');
    return NextResponse.redirect(back);
  }

  const { url, flow } = await beginLogin(origin, returnTo);
  const res = NextResponse.redirect(url);
  res.cookies.set(flowCookie(flow));
  // Sign-in popup of the embedded widget: tells components/PopupHandoff to pass the token on.
  if (new URL(request.url).searchParams.get('popup') === '1')
    res.cookies.set({
      name: POPUP_COOKIE_NAME,
      value: '1',
      path: '/',
      maxAge: 600,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  return res;
}
