'use client';

import { drukCondSuper, inconsolata } from '@/app/fonts/fonts';
import { Button } from '@/components/Button';
import { MicIcon } from '@/components/icons/MicIcon';
import { XIcon } from '@/components/icons/XIcon';
import { personaConfig } from '@/config/persona.config';
import { renderSessionCard } from '@/lib/sessionCardImage';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';
import { ReactNode, forwardRef } from 'react';

/**
 * End-of-session card, laid out like the original share card (ShareModal on
 * main): a branded frame, a summary strip, then full-width button rows. The
 * frame mirrors PersonaFrame's canvas layout in HTML, with session copy in
 * place of the idea.
 */
export const SessionEndCard = forwardRef<
  HTMLElement,
  {
    mood: AgentMoodI;
    onRestart: () => void;
    onSave: () => void;
    canSave: boolean;
    // Text agents swap the mic for their own icon and skip the Solène share post.
    againIcon?: ReactNode;
    shareable?: boolean;
    agentName?: string;
  }
>(
  (
    {
      mood,
      onRestart,
      onSave,
      canSave,
      againIcon = <MicIcon color="white" />,
      shareable = true,
      agentName = personaConfig.appName,
    },
    ref
  ) => {
    const moodConfig = personaConfig.moods[mood === AgentMoodEnum.SPANISH ? 'spanish' : 'english'];
    const card = moodConfig.endCard;
    // The post links to /share, whose preview on X is this card. Phones also
    // attach the card image itself through the system share sheet.
    const handleShare = async () => {
      const text = `${card.shareText} ${window.location.origin}/share?lang=${mood}`;
      const openPost = () =>
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');

      if (typeof navigator.canShare === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        try {
          const image = await renderSessionCard({
            label: personaConfig.appName,
            motif: card.motif,
            title: card.title,
            fonts: { display: drukCondSuper.style.fontFamily, mono: inconsolata.style.fontFamily },
          });
          const file = new File([image], 'solene-session.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
        }
      }
      openPost();
    };

    return (
      <section
        ref={ref}
        aria-labelledby="session-end-title"
        className="mt-3 flex w-full flex-col items-center gap-4 rounded-lg border border-[#E4EAEB] bg-white p-4 md:p-6 shadow-lg"
      >
        <div className="flex w-full flex-col items-start overflow-hidden rounded-lg md:rounded-none">
          {/* Frame */}
          <div
            className={clsx('relative w-full aspect-[650/340] bg-[#FAFAFA] text-[#111111]', inconsolata.className)}
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 0.8px, transparent 0.8px)',
              backgroundSize: '18px 18px',
            }}
          >
            <div className="absolute left-[5.5%] top-[9%]">
              <p className="text-[10px] md:text-xs font-medium uppercase text-[#A15EED]">{agentName}</p>
              <div className="mt-1.5 h-0.5 w-6 bg-[#A15EED]" />
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-[10%] text-center">
              <p className="text-xs md:text-base text-[#6B7280]">{card.motif}</p>
              <h2
                id="session-end-title"
                className={clsx(
                  'mt-2 md:mt-3 text-[clamp(2.25rem,9vw,4rem)] leading-none uppercase',
                  drukCondSuper.className
                )}
              >
                <span className="inline-block border-b-4 border-[#A15EED] px-2 pb-1">{card.title}</span>
              </h2>
            </div>

            <div className="absolute bottom-[6%] left-[5.5%]">
              <div className="h-0.5 w-4 bg-[#A15EED]" />
              <p className="mt-1.5 text-[9px] md:text-[10px] text-[#B0B7BC]">dev3pack.xyz</p>
            </div>
            {shareable && (
              <div className="absolute right-3 top-3 md:right-4 md:top-4 flex flex-col items-end gap-1.5 font-inter">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-full bg-[#171D21] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#273339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {card.shareLabel}
                </button>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dev3pack-logo.jpg"
              alt="Dev3pack"
              className="absolute bottom-[6%] right-[5%] h-5 md:h-7 w-auto"
            />
          </div>

          {/* Summary strip */}
          <div className="flex w-full items-center justify-center gap-2 border-t border-[#E4EAEB] bg-[#FAFAFA] px-2 py-3 md:px-4 text-center text-sm md:text-base leading-relaxed text-[#5C686D] font-inter">
            {card.body}
          </div>
        </div>

        <div className="mt-2 flex w-full flex-col items-center gap-3 md:flex-row">
          <Button
            appearance="colored"
            className="bg-[#A15EED] text-white hover:bg-[#7C3AED]"
            onClick={onRestart}
            stretch
          >
            {againIcon}
            {card.againLabel}
          </Button>
          <Button
            appearance="colored"
            className="bg-[#171D21] text-white hover:bg-[#273339]"
            onClick={onSave}
            disabled={!canSave}
            stretch
          >
            <DownloadIcon />
            {card.saveLabel}
          </Button>
        </div>

        <div className="flex w-full flex-col items-center gap-3 md:flex-row">
          <Button
            appearance="colored"
            className="bg-white text-[#171D21] border border-[#E4EAEB] hover:bg-[#F5F5F5]"
            href={personaConfig.siteUrl}
            target="_blank"
            stretch
          >
            {card.linkLabel}
          </Button>
        </div>
      </section>
    );
  }
);

SessionEndCard.displayName = 'SessionEndCard';

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
