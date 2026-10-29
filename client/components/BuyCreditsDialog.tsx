'use client';

import { CREDIT_PACKS_USD, SERVICE_FEE_BPS, packCreditUsd, toCredits } from '@/config/credits.config';
import type { WalletCredit } from '@/hooks/useWallet';
import { payWithX402 } from '@/lib/x402/pay';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

type Step = 'pick' | 'signing' | 'settling' | 'done';

/**
 * Buy a credit pack with USDC over x402. Not a native <dialog>: a modal one sits in
 * the top layer and would cover the wallet adapter's own picker.
 */
export function BuyCreditsDialog({ onPaid, onClose }: { onPaid: (credit: WalletCredit) => void; onClose: () => void }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible, visible: pickingWallet } = useWalletModal();
  const [pack, setPack] = useState<number>(CREDIT_PACKS_USD[0]);
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const connected = Boolean(wallet.connected && wallet.publicKey);
  const busy = step === 'signing' || step === 'settling';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && !pickingWallet && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, pickingWallet, onClose]);

  const pay = async () => {
    setError(null);
    setStep('signing');
    try {
      const { credit } = await payWithX402<{ credit: WalletCredit | null }>(
        '/api/wallet/topup',
        { pack },
        { connection, wallet, onSigned: () => setStep('settling') }
      );
      if (credit) onPaid(credit);
      setStep('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(/rejected|denied|cancel/i.test(message) ? null : message);
      setStep('pick');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={e => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="w-[min(400px,100%)] bg-white p-6 font-inter text-left shadow-xl">
        <h2 id="credits-dialog-title" className="text-lg font-semibold text-[#171D21]">
          Buy credits
        </h2>

        {step === 'done' ? (
          <p className="mt-2 text-sm text-[#5C686D]">
            {toCredits(packCreditUsd(pack))} credits added to your OpenRouter key.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#5C686D]">
              Pay in USDC on Solana. Credits go straight onto your OpenRouter key, less a {SERVICE_FEE_BPS / 100}%
              service fee.
            </p>
            <div role="radiogroup" aria-label="Credit pack" className="mt-4 grid grid-cols-3 gap-2">
              {CREDIT_PACKS_USD.map(usd => (
                <button
                  key={usd}
                  type="button"
                  role="radio"
                  aria-checked={pack === usd}
                  disabled={busy}
                  onClick={() => setPack(usd)}
                  className={clsx(
                    'flex flex-col items-center gap-1 border-2 py-3 transition-colors disabled:opacity-60',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]',
                    pack === usd ? 'border-[#A15EED] bg-[#A15EED]/5' : 'border-[#E4EAEB] hover:border-[#A15EED]/50'
                  )}
                >
                  <span className="text-lg font-semibold text-[#171D21]">{usd} USDC</span>
                  <span className="text-xs text-[#8E989C]">{toCredits(packCreditUsd(usd))} credits</span>
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-[#DC2626]">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 px-4 text-sm font-medium text-[#5C686D] hover:text-[#171D21] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
          >
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          {step !== 'done' && (
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={connected ? pay : () => setVisible(true)}
              className="inline-flex h-10 items-center gap-2 px-5 text-sm font-semibold text-white bg-[#A15EED] hover:bg-[#7C3AED] disabled:opacity-70 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {!connected
                ? 'Connect wallet'
                : step === 'signing'
                  ? 'Confirm in wallet…'
                  : step === 'settling'
                    ? 'Settling…'
                    : `Pay ${pack} USDC`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
