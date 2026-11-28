'use client';

import { personaConfig } from '@/config/persona.config';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';

// Phones show the short code in place of the name, so all six fit one row.
const OPTIONS: { mood: AgentMoodI; flag: string; code: string }[] = [
  { mood: AgentMoodEnum.ENGLISH, flag: '🇬🇧', code: 'EN' },
  { mood: AgentMoodEnum.SPANISH, flag: '🇪🇸', code: 'ES' },
  { mood: AgentMoodEnum.FRENCH, flag: '🇫🇷', code: 'FR' },
  { mood: AgentMoodEnum.TURKISH, flag: '🇹🇷', code: 'TR' },
  { mood: AgentMoodEnum.UKRAINIAN, flag: '🇺🇦', code: 'UA' },
  { mood: AgentMoodEnum.VIETNAMESE, flag: '🇻🇳', code: 'VI' },
];

// Square corners and tracked uppercase, like the CTA above it. The selected
// language gets a purple tint and underline rather than a solid fill, so the
// CTA stays the only filled element.
export function LanguageSelect({
  value,
  onChange,
  disabled,
  languages,
}: {
  value: AgentMoodI;
  onChange: (mood: AgentMoodI) => void;
  disabled?: boolean;
  // Only these are offered.
  languages: AgentMoodI[];
}) {
  const options = OPTIONS.filter(o => languages.includes(o.mood));
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex border border-[#E4EAEB] bg-white">
      {options.map(({ mood, flag, code }, i) => {
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
              'flex h-10 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-4 font-inter text-xs font-semibold uppercase tracking-[0.15em] transition-colors',
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
            <span className="sm:hidden" aria-hidden="true">
              {code}
            </span>
            <span className="sr-only sm:not-sr-only">{personaConfig.moods[mood].label}</span>
          </button>
        );
      })}
    </div>
  );
}
