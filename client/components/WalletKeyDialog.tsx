'use client';

import { toCredits } from '@/config/credits.config';
import { WalletCredit } from '@/hooks/useWallet';
import { useEffect, useRef, useState } from 'react';

/** Shows a new member their OpenRouter key and its credit. The server hands the key out only once. */
export function WalletKeyDialog({
  openrouterKey,
  credit,
  onClose,
}: {
  openrouterKey: string;
  credit: WalletCredit | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(openrouterKey).catch(() => undefined);
    setCopied(true);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="wallet-dialog-title"
      className="w-[min(420px,calc(100vw-2rem))] bg-white p-6 font-inter text-left shadow-xl backdrop:bg-black/40"
    >
      <h2 id="wallet-dialog-title" className="text-lg font-semibold text-[#171D21]">
        Your OpenRouter key
      </h2>
      <p className="mt-2 text-sm text-[#5C686D]">
        The voice agent spends from this key, which has {credit?.limit != null ? toCredits(credit.limit) : '—'} credits.
        This is the only time it is shown, so copy it now if you want to keep it.
      </p>
      <code className="mt-4 block break-all bg-[#F5F5F5] p-3 text-xs text-[#171D21]">{openrouterKey}</code>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={copy}
          className="h-10 px-4 text-sm font-medium text-[#5C686D] hover:text-[#171D21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => ref.current?.close()}
          className="h-10 px-5 text-sm font-semibold text-white bg-[#A15EED] hover:bg-[#7C3AED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
