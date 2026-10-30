'use client';

import { useEffect, useState } from 'react';

export type WalletCredit = { limit: number | null; usage: number | null; remaining: number | null };

/** The signed-in member's OpenRouter wallet credit. The key itself never leaves the server. */
export function useWallet(signedIn: boolean) {
  const [credit, setCredit] = useState<WalletCredit | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setCredit(null);
      return;
    }
    fetch('/api/wallet', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => setCredit(body?.credit ?? null))
      .catch(() => undefined);
  }, [signedIn]);

  return { credit, setCredit };
}
