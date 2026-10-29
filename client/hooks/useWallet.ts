'use client';

import { useCallback, useEffect, useState } from 'react';

export type WalletCredit = { limit: number | null; usage: number | null; remaining: number | null };

/**
 * The signed-in member's OpenRouter wallet: its credit, and the key the one time
 * the server hands it out (null after that, and once dismissed).
 */
export function useWallet(signedIn: boolean) {
  const [credit, setCredit] = useState<WalletCredit | null>(null);
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setCredit(null);
      setKey(null);
      return;
    }
    fetch('/api/wallet', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        setCredit(body?.credit ?? null);
        // Only the first answer carries the key; a second fetch (Strict Mode) must not clear it.
        if (body?.key) setKey(body.key);
      })
      .catch(() => undefined);
  }, [signedIn]);

  const dismissKey = useCallback(() => setKey(null), []);

  return { credit, setCredit, key, dismissKey };
}
