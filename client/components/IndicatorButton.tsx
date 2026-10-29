'use client';

import { ReactNode } from 'react';

/**
 * A round toggle whose border doubles as a speaking indicator: the ring
 * thickens with the track's volume, and turns grey when the toggle is off.
 */
export function IndicatorButton({
  volume,
  off,
  color,
  label,
  onClick,
  disabled,
  size = 56,
  children,
}: {
  volume: number;
  off: boolean;
  color: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  size?: number;
  children: ReactNode;
}) {
  // useTrackVolume reports speech at roughly 0–0.25, so scale it up to 0–1.
  const level = off ? 0 : Math.min(1, volume * 4);
  const ringColor = off ? '#D0D7DE' : level > 0.05 ? color : `${color}66`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={off}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-full bg-white text-[#273339] flex items-center justify-center transition-[box-shadow] duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 ${2 + level * 6}px ${ringColor}, 0 4px 10px rgba(0, 0, 0, 0.12)`,
      }}
    >
      {children}
    </button>
  );
}
