'use client';

import { useEffect } from 'react';

const MARKER = 'solene_popup'; // same as POPUP_COOKIE_NAME in lib/auth.ts

// When the app runs in an iframe, sign-in happens in a popup (see hooks/useAuth).
// Wherever that popup ends up after login, this passes the session token to the
// iframe that opened it and closes the popup. /api/auth/login sets the marker
// cookie, which survives the trip through Salts' login pages and any redirect hiccup.
export default function PopupHandoff() {
  useEffect(() => {
    if (!document.cookie.split('; ').some(c => c.startsWith(`${MARKER}=`)) || !window.opener) return;
    document.cookie = `${MARKER}=; Max-Age=0; Path=/`;
    const error = new URL(window.location.href).searchParams.get('auth_error');
    (async () => {
      const res = await fetch('/api/auth/token', { cache: 'no-store' }).catch(() => null);
      const token: string | null = res?.ok ? ((await res.json()).token ?? null) : null;
      // The opener is the iframe, which is on this origin, so only this origin may hear it.
      window.opener.postMessage(
        { type: 'solene-auth', token, error: token ? null : (error ?? 'failed') },
        window.location.origin
      );
      window.close();
    })();
  }, []);
  return null;
}
