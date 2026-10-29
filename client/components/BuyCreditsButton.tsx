'use client';

import { WalletIcon } from '@/components/icons/WalletIcon';

// Styled after the GitHub star button beside it (react-github-btn, large): one
// pill split into the button and the count.
const GITHUB_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';

export function BuyCreditsButton({ credits, onClick }: { credits: number | null; onClick: () => void }) {
  return (
    <div
      className="flex h-7 shrink-0 items-stretch overflow-hidden whitespace-nowrap rounded-md border border-[#d1d9e0] text-xs font-semibold leading-none text-[#25292e]"
      style={{ fontFamily: GITHUB_FONT }}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 bg-[#f6f8fa] px-2.5 hover:bg-[#eff2f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0969da]"
      >
        <WalletIcon className="h-4 w-4" />
        {/* "Buy" on phones, so the header fits beside Sign out and GitHub. */}
        <span className="sm:hidden">Buy</span>
        <span className="hidden sm:inline">Buy credits</span>
      </button>
      {/* Null while the credit loads. */}
      <span className="inline-flex items-center border-l border-[#d1d9e0] bg-white px-2.5">
        {credits ?? '…'} credits
      </span>
    </div>
  );
}
