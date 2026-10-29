'use client';

import { Button } from '@/components/Button';
import { ChatRoom } from '@/components/ChatRoom';
import { LanguageSelect } from '@/components/LanguageSelect';
import { MicDialogState, MicPermissionDialog, micPermission } from '@/components/MicPermissionDialog';
import { personaConfig } from '@/config/persona.config';
import { NEEDS_PAYMENT, useTalkSession } from '@/hooks/useTalkSession';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GitHubButton from 'react-github-btn';
import { nyghtMedium } from './fonts/fonts';

const LANGUAGE_KEY = 'solene-language';

export default function HomePage() {
  const router = useRouter();
  const [mood, setMood] = useState<AgentMoodI>(AgentMoodEnum.ENGLISH);
  const { room, status, error, start, reset } = useTalkSession();
  const starting = status === 'connecting';
  const moodConfig = personaConfig.moods[mood];
  const [micDialog, setMicDialog] = useState<MicDialogState | null>(null);

  // Remember the last language picked on this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (saved === AgentMoodEnum.ENGLISH || saved === AgentMoodEnum.FRENCH) setMood(saved);
    } catch {}
  }, []);

  const handleLanguageChange = (next: AgentMoodI) => {
    setMood(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {}
  };

  const handleStart = async () => {
    // Paid sessions go through the wallet flow on /talk first.
    if (NEEDS_PAYMENT) {
      router.push(`/talk?mood=${mood}`);
      return;
    }
    // Ask for the mic in our own dialog first, unless access is already granted.
    const permission = await micPermission();
    if (permission === 'granted') start(mood);
    else setMicDialog(permission === 'denied' ? 'blocked' : 'ask');
  };

  if (room && (status === 'connected' || status === 'ended')) {
    return <ChatRoom room={room} mood={mood} ended={status === 'ended'} onRestart={reset} />;
  }

  // Header, hero and footer rows; the hero centres in the middle one. Title,
  // avatar and gaps all scale with the viewport height (clamped), so the hero
  // keeps its proportions and fits one screen instead of one part shrinking.
  return (
    <main className="min-h-dvh grid grid-rows-[auto_1fr_auto] bg-[#F5F5F5] relative">
      {/* Dot pattern background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      <header className="z-20 w-full flex justify-end items-center gap-3 px-4 md:px-6 pt-4">
        <GitHubButton
          href={personaConfig.footer.githubRepo}
          data-color-scheme="no-preference: light; light: light; dark: dark;"
          data-size="large"
          data-show-count="true"
          aria-label="Star Solène on GitHub"
        >
          Star
        </GitHubButton>
      </header>

      <div className="z-10 flex flex-col items-center text-center justify-center px-6 py-4">
        {/* Title block */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'text-6xl md:text-[clamp(4.5rem,11dvh,7rem)] text-[#A15EED] leading-[0.9] tracking-[0.04em]',
              nyghtMedium.className
            )}
          >
            {personaConfig.heroTitle}
          </motion.h1>

          {/* Decorative rule */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-5 md:mt-6 w-16 h-px bg-[#A15EED]/40"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-4 md:mt-5 text-xs md:text-sm text-[#8E989C] font-inter font-medium tracking-[0.25em] uppercase"
          >
            {moodConfig.heroSubtitle}
          </motion.p>
        </div>

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-[clamp(1.25rem,4dvh,2.5rem)] grid justify-items-center"
        >
          {/* Both language avatars share one cell and crossfade, so switching never flashes blank. */}
          {[AgentMoodEnum.ENGLISH, AgentMoodEnum.FRENCH].map(m => (
            <Image
              key={m}
              src={personaConfig.moods[m].avatarImage}
              alt={m === mood ? personaConfig.heroAvatarAlt : ''}
              aria-hidden={m !== mood}
              width={328}
              height={328}
              className={clsx(
                '[grid-area:1/1] h-auto w-[clamp(140px,26dvh,200px)] md:w-[clamp(180px,30dvh,300px)] transition-opacity duration-300 motion-reduce:transition-none',
                m === mood ? 'opacity-100' : 'opacity-0'
              )}
              priority
            />
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-[clamp(1.25rem,4dvh,2.5rem)] flex flex-col items-center gap-4"
        >
          <Button
            onClick={handleStart}
            disabled={starting}
            aria-busy={starting}
            className={clsx('inline-flex items-center justify-center gap-3', starting && 'cursor-wait opacity-90')}
          >
            {starting && <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {starting ? moodConfig.startingLabel : moodConfig.startChatButtonLabel}
          </Button>
          <LanguageSelect value={mood} onChange={handleLanguageChange} disabled={starting} />
          {/* Out of the flow, so an error never pushes the page into scrolling. */}
          <p role="alert" className="absolute inset-x-0 top-full mt-3 text-sm font-inter text-[#DC2626]">
            {error}
          </p>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="z-10 w-full flex md:flex-row flex-col justify-between text-[#5C686D] text-xs md:text-sm font-inter py-5 md:px-16 px-8 gap-3 text-center md:text-left">
        <div>
          Made with {'<3'} by{' '}
          <a
            href={personaConfig.footer.creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#A15EED] transition-colors"
          >
            {personaConfig.footer.credit}
          </a>{' '}
          and{' '}
          <a
            href="https://bonfires.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#A15EED] transition-colors"
          >
            Bonfires AI
          </a>
        </div>
        <div className="flex flex-row gap-6 justify-center">
          {personaConfig.footer.socialLinks.map(link => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#A15EED] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {micDialog && (
        <MicPermissionDialog
          mood={mood}
          initialState={micDialog}
          onClose={() => setMicDialog(null)}
          onGranted={() => {
            setMicDialog(null);
            start(mood);
          }}
        />
      )}

      {/* Prefetch avatar images for faster loading */}
      <link rel="prefetch" href={personaConfig.moods.english.avatarImage} as="image" type="image/gif" />
      <link rel="prefetch" href={personaConfig.moods.french.avatarImage} as="image" type="image/gif" />
    </main>
  );
}
