'use client';

import { personaConfig } from '@/config/persona.config';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';

const OPTIONS: { mood: AgentMoodI; flag: string }[] = [
  { mood: AgentMoodEnum.ENGLISH, flag: '🇬🇧' },
  { mood: AgentMoodEnum.SPANISH, flag: '🇪🇸' },
];

// Square corners and tracked uppercase, like the CTA above it. The selected
// language gets a purple tint and underline rather than a solid fill, so the
// CTA stays the only filled element.
export function LanguageSelect({
  value,
  onChange,
  disabled,
}: {
  value: AgentMoodI;
  onChange: (mood: AgentMoodI) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex border border-[#E4EAEB] bg-white">
      {OPTIONS.map(({ mood, flag }, i) => {
        const selected = mood === value;
        return (
          <button
            key={mood}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(mood)}
            className={clsx(
              'flex h-10 items-center gap-2 px-4 font-inter text-xs font-semibold uppercase tracking-[0.15em] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A15EED]',
              'disabled:cursor-not-allowed',
              i > 0 && 'border-l border-[#E4EAEB]',
              selected
                ? 'bg-[#A15EED]/10 text-[#7C3AED] shadow-[inset_0_-2px_0_#A15EED]'
                : 'text-[#5C686D] hover:bg-[#F5F5F5] hover:text-[#171D21]'
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {flag}
            </span>
            {personaConfig.moods[mood].label}
          </button>
        );
      })}
    </div>
  );
}
