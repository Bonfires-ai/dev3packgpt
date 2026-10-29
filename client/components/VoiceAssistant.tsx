import { AgentAudioVisualizerRadial } from '@/components/AgentAudioVisualizerRadial';
import { NoAgentNotification } from '@/components/NoAgentNotification';
import { SessionEndCard } from '@/components/SessionEndCard';
import TranscriptionView, { mergeConsecutiveSegments, sanitizeText } from '@/components/TranscriptionView';
import { MicIcon } from '@/components/icons/MicIcon';
import { personaConfig } from '@/config/persona.config';
import useCombinedTranscriptions, { type Transcription } from '@/hooks/useCombinedTranscriptions';
import useLocalMicTrack from '@/hooks/useLocalMicTrack';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import {
  type AgentState,
  RoomAudioRenderer,
  StartMediaButton,
  type TrackReferenceOrPlaceholder,
  useIsSpeaking,
  useRoomContext,
  useTrackToggle,
  useVoiceAssistant,
} from '@livekit/components-react';
import clsx from 'clsx';
import { Track } from 'livekit-client';
import Image from 'next/image';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';

// If the agent never closes the room after End, leave it ourselves.
const END_FALLBACK_MS = 5000;

export function VoiceAssistant({
  mood,
  ended,
  onRestart,
}: {
  mood: AgentMoodI;
  ended?: boolean;
  onRestart: () => void;
}) {
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();

  const room = useRoomContext();

  const moodKey = mood === AgentMoodEnum.FRENCH ? 'french' : 'english';
  const moodConfig = personaConfig.moods[moodKey];
  const accent = moodConfig.visualizerBgColor;

  const [ending, setEnding] = useState(false);

  // Messages the agent never sends back as transcriptions: the greeting, shown
  // without voice the moment the room connects, and anything the user types.
  const [localMessages, setLocalMessages] = useState<Transcription[]>(() => [
    { id: 'local-greeting', text: moodConfig.greeting, role: 'assistant', firstReceivedTime: Date.now(), local: true },
  ]);
  const [draft, setDraft] = useState('');

  // When muted the agent replies in text only and makes no TTS calls.
  const [agentMuted, setAgentMuted] = useState(false);

  const micTrackRef = useLocalMicTrack();
  const userSpeaking = useIsSpeaking(micTrackRef.participant);
  const {
    enabled: micEnabled,
    pending: micPending,
    toggle: toggleMic,
  } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  const combinedTranscriptions = useCombinedTranscriptions(localMessages);

  // Bring the end card into view when the session ends.
  const endCardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ended) endCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ended]);

  useEffect(() => {
    if (!ending || ended) return;
    const timer = setTimeout(() => room.disconnect(), END_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [ending, ended, room]);

  const handleEndConversation = async () => {
    setEnding(true);
    // The agent posts its goodbye as text and closes the room, with no LLM turn.
    await room.localParticipant.sendText('end', { topic: 'user_end_conversation' });
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const now = Date.now();
    setLocalMessages(prev => [
      ...prev,
      { id: `local-${now}`, text, role: 'user', firstReceivedTime: now, local: true },
    ]);
    await room.localParticipant.sendText(text, { topic: 'lk.chat' });
  };

  const handleToggleMute = async () => {
    const next = !agentMuted;
    setAgentMuted(next);
    await room.localParticipant.sendText(String(next), { topic: 'agent_audio_muted' });
  };

  const handleSaveSession = () => {
    const started = combinedTranscriptions[0]?.firstReceivedTime ?? Date.now();
    const lines = mergeConsecutiveSegments(combinedTranscriptions).map(
      segment => `${segment.role === 'assistant' ? personaConfig.appName : 'You'}: ${sanitizeText(segment.text)}`
    );
    const header = `Session with ${personaConfig.appName} (${moodConfig.label}) — ${new Date(started).toLocaleString()}`;
    const blob = new Blob([`${header}\n\n${lines.join('\n\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solene-session-${new Date(started).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const inSession = !ended && !ending;

  return (
    // Header, scrolling messages and input stack as three rows, so the input
    // never covers the messages and the messages get all the spare height.
    <div className="fixed inset-0 flex flex-col bg-[#F5F5F5]">
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
          combinedTranscriptions={combinedTranscriptions}
          showThinking={inSession}
          footer={
            ended && (
              <SessionEndCard
                ref={endCardRef}
                mood={mood}
                onRestart={onRestart}
                onSave={handleSaveSession}
                canSave={combinedTranscriptions.length > 0}
              />
            )
          }
          header={
            // Scrolls with the messages, so a long chat isn't pinned under it.
            <div className="flex justify-center pt-8">
              <Image
                src={moodConfig.avatarImage}
                alt={`${moodConfig.label} Avatar`}
                width={254}
                height={254}
                className="rounded-none md:w-[254px] md:h-[254px] w-[200px] h-[200px]"
                priority
              />
            </div>
          }
        />
      </div>

      <RoomAudioRenderer muted={agentMuted} />
      <NoAgentNotification state={agentState} />

      <footer className={clsx('shrink-0 px-4', !ended && 'pb-5 pt-2')}>
        {!ended && (
          <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-3">
            <StartMediaButton />
            <form onSubmit={handleSend} className="flex w-full items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={moodConfig.inputPlaceholder}
                aria-label={moodConfig.inputPlaceholder}
                disabled={!inSession}
                className="h-12 min-w-0 flex-1 rounded-full border border-[#E4EAEB] bg-white px-5 text-[#171D21] font-inter shadow-sm outline-none focus:border-[#A15EED] focus:ring-2 focus:ring-[#A15EED]/30 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !inSession}
                aria-label={moodConfig.sendLabel}
                title={moodConfig.sendLabel}
                className="h-12 w-12 shrink-0 rounded-full text-white flex items-center justify-center shadow-sm transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
                style={{ backgroundColor: accent }}
              >
                <SendIcon />
              </button>
            </form>

            {/* Call controls. The rings are LiveKit's radial visualizer: they follow
                the voice level, and for Solène also show listening and thinking. */}
            <div className="flex items-center justify-center gap-8 pt-1">
              <RingButton
                label={micEnabled ? moodConfig.micMuteLabel : moodConfig.micUnmuteLabel}
                pressed={!micEnabled}
                onClick={() => toggleMic()}
                disabled={micPending || !inSession}
                state={ringState(!micEnabled, userSpeaking ? 'speaking' : 'listening')}
                audioTrack={micTrackRef}
                color={accent}
              >
                {micEnabled ? <MicIcon color="#273339" /> : <MicOffIcon />}
              </RingButton>
              <button
                type="button"
                onClick={handleEndConversation}
                disabled={ending}
                aria-label={moodConfig.endCallLabel}
                title={moodConfig.endCallLabel}
                className="h-14 w-14 shrink-0 rounded-full bg-[#F06444] hover:bg-[#DC2626] text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#DC2626]"
              >
                <PhoneDownIcon />
              </button>
              <RingButton
                label={agentMuted ? moodConfig.unmuteLabel : moodConfig.muteLabel}
                pressed={agentMuted}
                onClick={handleToggleMute}
                disabled={!inSession}
                state={ringState(agentMuted, agentState)}
                audioTrack={agentAudioTrack}
                color={accent}
              >
                <SpeakerIcon muted={agentMuted} />
              </RingButton>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

/**
 * Both rings share one look: faint and still at rest, lit and following the
 * voice while speaking, spinning while Solène thinks. The visualizer shows
 * 'disconnected' as a faint ring, so rest and mute map to it.
 */
function ringState(muted: boolean, state: AgentState): AgentState {
  if (muted) return 'disconnected';
  return state === 'speaking' || state === 'thinking' ? state : 'disconnected';
}

/** A round toggle with a radial voice visualizer around it. */
function RingButton({
  label,
  pressed,
  onClick,
  disabled,
  state,
  audioTrack,
  color,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  state: AgentState;
  audioTrack?: TrackReferenceOrPlaceholder;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <AgentAudioVisualizerRadial
        className="absolute inset-0"
        radius={34}
        barCount={24}
        state={state}
        audioTrack={audioTrack}
        color={pressed ? '#8E989C' : color}
      />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
        aria-label={label}
        title={label}
        className="relative h-14 w-14 rounded-full bg-white text-[#273339] flex items-center justify-center shadow-md transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
      >
        {children}
      </button>
    </div>
  );
}

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
    {muted ? (
      <path d="m23 9-6 6M17 9l6 6" strokeLinecap="round" />
    ) : (
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" strokeLinecap="round" />
    )}
  </svg>
);

const MicOffIcon = () => (
  <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E989C" strokeWidth="2" aria-hidden="true">
    <path
      d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8M19 11v1a7 7 0 0 1-1.1 3.8M5 11v1a7 7 0 0 0 11.6 5.3M12 19v3M8 22h8M3 3l18 18"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PhoneDownIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    aria-hidden="true"
  >
    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
