'use client';

import { nyghtMedium } from '@/app/fonts/fonts';
import { SessionEndCard } from '@/components/SessionEndCard';
import TranscriptionView from '@/components/TranscriptionView';
import { PhoneDownIcon } from '@/components/icons/PhoneDownIcon';
import { personaConfig } from '@/config/persona.config';
import type { SaltsAgent } from '@/config/salts.config';
import type { Transcription } from '@/hooks/useCombinedTranscriptions';
import { downloadTranscript } from '@/lib/transcript';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { FormEvent, useEffect, useRef, useState } from 'react';

/**
 * The text-only chat room for a Salts agent. Same layout as VoiceAssistant
 * (scrolling messages, input, end button, end card), without audio.
 */
export function TextAssistant({
  agent,
  mood,
  messages,
  thinking,
  replying,
  ended,
  onSend,
  onEnd,
  onRestart,
}: {
  agent: SaltsAgent;
  mood: AgentMoodI;
  messages: Transcription[];
  thinking: boolean;
  replying: boolean;
  ended: boolean;
  onSend: (text: string) => void;
  onEnd: () => void;
  onRestart: () => void;
}) {
  const moodConfig = personaConfig.moods[mood === AgentMoodEnum.SPANISH ? 'spanish' : 'english'];
  const accent = moodConfig.visualizerBgColor;
  const withName = (label: string) => label.replace('{name}', agent.name);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Bring the end card into view when the session ends.
  const endCardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ended) endCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ended]);

  // Keep the input ready for the next message once a reply finishes.
  useEffect(() => {
    if (!replying && !ended) inputRef.current?.focus();
  }, [replying, ended]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || replying) return;
    setDraft('');
    onSend(text);
  };

  const handleSaveSession = () =>
    downloadTranscript({
      messages,
      mood,
      agentName: agent.name,
      title: `${agent.name} · ${new Date(messages[0]?.firstReceivedTime ?? Date.now()).toLocaleDateString()}`,
      filePrefix: `${agent.slug}-session`,
    });

  return (
    <motion.main
      className="fixed inset-0 z-30 flex flex-col bg-[#F5F5F5]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
        aria-hidden="true"
      ></div>

      <div className="min-h-0 flex-1">
        <TranscriptionView
          mood={mood}
          combinedTranscriptions={messages}
          thinking={!ended && thinking}
          footer={
            ended && (
              <SessionEndCard
                ref={endCardRef}
                mood={mood}
                onRestart={onRestart}
                onSave={handleSaveSession}
                canSave={messages.length > 0}
                againIcon={<ChatIcon />}
                shareable={false}
                agentName={agent.name}
              />
            )
          }
          header={
            // Scrolls with the messages, like the avatar in the voice room.
            <div className="flex flex-col items-center pt-10 text-center">
              <h1 className={clsx('text-4xl md:text-5xl text-[#A15EED] tracking-[0.04em]', nyghtMedium.className)}>
                {agent.name}
              </h1>
              <div className="mx-auto mt-4 w-12 h-px bg-[#A15EED]/40" />
            </div>
          }
        />
      </div>

      <footer className={clsx('shrink-0 px-4', !ended && 'pb-5 pt-2')}>
        {!ended && (
          <div className="mx-auto flex w-full max-w-[720px] items-center gap-2">
            <form onSubmit={handleSend} className="flex min-w-0 flex-1 items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={withName(moodConfig.textPlaceholder)}
                aria-label={withName(moodConfig.textPlaceholder)}
                autoFocus
                className="h-12 min-w-0 flex-1 rounded-full border border-[#E4EAEB] bg-white px-5 text-[#171D21] font-inter shadow-sm outline-none focus:border-[#A15EED] focus:ring-2 focus:ring-[#A15EED]/30"
              />
              <button
                type="submit"
                disabled={!draft.trim() || replying}
                aria-label={moodConfig.sendLabel}
                title={moodConfig.sendLabel}
                className="h-12 w-12 shrink-0 rounded-full text-white flex items-center justify-center shadow-sm transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
                style={{ backgroundColor: accent }}
              >
                <SendIcon />
              </button>
            </form>
            <button
              type="button"
              onClick={onEnd}
              aria-label={moodConfig.endChatLabel}
              title={moodConfig.endChatLabel}
              className="h-12 w-12 shrink-0 rounded-full bg-[#F06444] hover:bg-[#DC2626] text-white flex items-center justify-center shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#DC2626]"
            >
              <PhoneDownIcon />
            </button>
          </div>
        )}
      </footer>
    </motion.main>
  );
}

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" />
  </svg>
);

// A paper plane.
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
