export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.5 4.5V3a1 1 0 0 0-1-1h-8A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1H3.5" />
      <path d="M11.25 9.25h.01" strokeWidth="2" />
    </svg>
  );
}
