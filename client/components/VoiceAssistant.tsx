import { Button } from '@/components/Button';
import { IndicatorButton } from '@/components/IndicatorButton';
import { NoAgentNotification } from '@/components/NoAgentNotification';
import TranscriptionView, { mergeConsecutiveSegments, sanitizeText } from '@/components/TranscriptionView';
import { MicIcon } from '@/components/icons/MicIcon';
import { personaConfig } from '@/config/persona.config';
import useCombinedTranscriptions, { type Transcription } from '@/hooks/useCombinedTranscriptions';
import useIsPhone from '@/hooks/useIsPhone';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import {
  RoomAudioRenderer,
  StartMediaButton,
  useLocalParticipant,
  useRoomContext,
  useTrackToggle,
  useTrackVolume,
  useVoiceAssistant,
} from '@livekit/components-react';
import clsx from 'clsx';
import { LocalAudioTrack, Track } from 'livekit-client';
import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';

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

  const [ending, setEnding] = useState(false);

  // Messages the agent never sends back as transcriptions: the greeting, shown
  // without voice the moment the room connects, and anything the user types.
  const [localMessages, setLocalMessages] = useState<Transcription[]>(() => [
    { id: 'local-greeting', text: moodConfig.greeting, role: 'assistant', firstReceivedTime: Date.now(), local: true },
  ]);
  const [draft, setDraft] = useState('');

  // When muted the agent replies in text only and makes no TTS calls.
  const [agentMuted, setAgentMuted] = useState(false);
  const agentVolume = useTrackVolume(agentAudioTrack);

  const { microphoneTrack } = useLocalParticipant();
  const micVolume = useTrackVolume(microphoneTrack?.track as LocalAudioTrack | undefined);
  const {
    enabled: micEnabled,
    pending: micPending,
    toggle: toggleMic,
  } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  const combinedTranscriptions = useCombinedTranscriptions(localMessages);

  const isPhone = useIsPhone();

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
    <div className="fixed inset-0 flex flex-col items-center bg-[#F5F5F5] pt-8">
      <div
        className="absolute inset-0 pointer-events-none -z-10 h-full w-full"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
        aria-hidden="true"
      ></div>

      <div className="flex flex-row items-start gap-4 mb-6">
        <Image
          src={moodConfig.avatarImage}
          alt={`${moodConfig.label} Avatar`}
          width={254}
          height={254}
          className="rounded-none md:w-[254px] md:h-[254px] w-[200px] h-[200px]"
          priority
        />
        {/* Solène's mute toggle, with her speaking indicator as its ring, and the hang-up button. */}
        <div className="mt-[64px] flex flex-col items-center gap-5">
          <IndicatorButton
            volume={agentState === 'speaking' ? agentVolume : 0}
            off={agentMuted}
            color={moodConfig.visualizerBgColor}
            label={agentMuted ? moodConfig.unmuteLabel : moodConfig.muteLabel}
            onClick={handleToggleMute}
            disabled={!inSession}
          >
            <SpeakerIcon muted={agentMuted} />
          </IndicatorButton>
          {!ended && (
            <button
              type="button"
              onClick={handleEndConversation}
              disabled={ending}
              aria-label={moodConfig.endCallLabel}
              title={moodConfig.endCallLabel}
              className="w-[56px] h-[56px] shrink-0 rounded-full bg-[#F06444] hover:bg-[#DC2626] text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              <PhoneDownIcon />
            </button>
          )}
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col items-center overflow-hidden z-10">
        <TranscriptionView mood={mood} combinedTranscriptions={combinedTranscriptions} showThinking={inSession} />
      </div>

      <RoomAudioRenderer muted={agentMuted} />
      <NoAgentNotification state={agentState} />

      {/* Input row, fixed at the bottom */}
      {!ended && (
        <div className="w-full flex flex-col items-center fixed bottom-0 left-0 px-4 py-6 z-10 gap-3">
          <StartMediaButton />
          <form onSubmit={handleSend} className="w-full md:w-[700px] flex items-center gap-3">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={moodConfig.inputPlaceholder}
              aria-label={moodConfig.inputPlaceholder}
              disabled={!inSession}
              className="flex-1 min-w-0 h-[48px] rounded-xl bg-white/90 shadow-lg px-4 text-[#273339] font-inter outline-none focus:ring-2 focus:ring-[#A15EED] disabled:opacity-60"
            />
            <IndicatorButton
              size={48}
              volume={micVolume}
              off={!micEnabled}
              color={moodConfig.visualizerBgColor}
              label={micEnabled ? moodConfig.micMuteLabel : moodConfig.micUnmuteLabel}
              onClick={() => toggleMic()}
              disabled={micPending || !inSession}
            >
              {micEnabled ? <MicIcon color="#273339" /> : <MicOffIcon />}
            </IndicatorButton>
            <button
              type="submit"
              disabled={!draft.trim() || !inSession}
              aria-label={moodConfig.sendLabel}
              title={moodConfig.sendLabel}
              className="w-[48px] h-[48px] shrink-0 rounded-full text-white flex items-center justify-center shadow-lg disabled:opacity-50"
              style={{ backgroundColor: moodConfig.visualizerBgColor }}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {ended && (
        <div className="w-full flex justify-center fixed bottom-0 left-0 px-4 py-8 z-10">
          <div className="w-full md:w-[700px] bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 font-inter">
            <h2 className="text-xl md:text-2xl font-bold text-[#171D21]">{moodConfig.endCard.title}</h2>
            <p className="text-sm md:text-base text-[#273339]">{moodConfig.endCard.body}</p>
            <a
              href={personaConfig.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm md:text-base underline"
              style={{ color: moodConfig.visualizerBgColor }}
            >
              {moodConfig.endCard.linkLabel}
            </a>
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                appearance="colored"
                stretch={isPhone}
                className={clsx(
                  mood === AgentMoodEnum.ENGLISH ? 'text-white bg-synthesis' : 'text-white bg-synthesis-dark shadow-lg'
                )}
                onClick={handleSaveSession}
                disabled={combinedTranscriptions.length === 0}
              >
                <DownloadIcon />
                {moodConfig.endCard.saveLabel}
              </Button>
              <Button
                appearance="colored"
                stretch={isPhone}
                className="bg-white text-black border border-[#E4EAEB]"
                onClick={onRestart}
              >
                <MicIcon color="black" />
                {moodConfig.endCard.againLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
