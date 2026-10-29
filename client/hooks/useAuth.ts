'use client';

import { useCallback, useEffect, useState } from 'react';

// Messages for the ?auth_error=<reason> the sign-in callback sends back.
const AUTH_ERRORS: Record<string, string> = {
  not_in_fleet: 'This email is not authorized to chat with the agents.',
  unverified: 'Your email is not verified yet.',
  denied: 'Sign-in was cancelled.',
  expired: 'Sign-in took too long. Please try again.',
  failed: "Couldn't sign you in. Please try again.",
  not_configured: 'Sign-in is not set up on this server yet.',
};

export type AuthUser = { email: string; name?: string; picture?: string };

/** Two letters for the user: first and last name, else the email's name part. */
export function userInitials({ name, email }: AuthUser): string {
  const words = (name || email.split('@')[0]).split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/** The user's first name, else the email's name part, capitalised. */
export function userFirstName({ name, email }: AuthUser): string {
  const first = (name || email.split('@')[0]).split(/[\s._-]+/).find(Boolean) ?? email;
  return first[0].toUpperCase() + first.slice(1);
}

/** The signed-in user (null when signed out, undefined while loading) and sign in/out. */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(body => setUser(body.user ?? null))
      .catch(() => setUser(null));

    // Show a failed sign-in once, then drop the reason from the address bar.
    const url = new URL(window.location.href);
    const reason = url.searchParams.get('auth_error');
    if (reason) {
      setAuthError(AUTH_ERRORS[reason] ?? AUTH_ERRORS.failed);
      url.searchParams.delete('auth_error');
      window.history.replaceState(null, '', url);
    }
  }, []);

  const signIn = useCallback((returnTo = window.location.pathname + window.location.search) => {
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    email: user?.email,
    signedIn: !!user,
    loading: user === undefined,
    authError,
    clearAuthError,
    signIn,
    signOut,
  };
}
