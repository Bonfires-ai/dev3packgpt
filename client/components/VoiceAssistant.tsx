import { Button } from '@/components/Button';
import { CustomVoiceAssistantControlBar } from '@/components/CustomVoiceAssistantControlBar';
import { NoAgentNotification } from '@/components/NoAgentNotification';
import TranscriptionView, { mergeConsecutiveSegments, sanitizeText } from '@/components/TranscriptionView';
import { CloseIcon } from '@/components/icons/CloseIcon';
import { MicIcon } from '@/components/icons/MicIcon';
import { personaConfig } from '@/config/persona.config';
import useCombinedTranscriptions, { type Transcription } from '@/hooks/useCombinedTranscriptions';
import useIsPhone from '@/hooks/useIsPhone';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import { RoomAudioRenderer, useChat, useRoomContext, useVoiceAssistant } from '@livekit/components-react';
import clsx from 'clsx';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import AudioVisualizer from './AudioVisualizer/AudioVisualizer';
import { Loader } from './Loader';

export function VoiceAssistant({ mood, ended }: { mood: AgentMoodI; ended?: boolean }) {
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();

  const room = useRoomContext();

  const { send } = useChat();

  const [loading, setLoading] = useState(false);

  // Typed messages: the agent receives them on lk.chat but does not echo them back.
  const [typedMessages, setTypedMessages] = useState<Transcription[]>([]);
  const [draft, setDraft] = useState('');

  // When muted the agent replies in text only and makes no TTS calls.
  const [agentMuted, setAgentMuted] = useState(false);

  const combinedTranscriptions = useCombinedTranscriptions(typedMessages);

  const isPhone = useIsPhone();

  const router = useRouter();

  const handleEndConversation = () => {
    send('Goodbye for now. Please end the conversation', {
      topic: 'user_end_conversation',
    });

    setLoading(true);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const now = Date.now();
    setTypedMessages(prev => [...prev, { id: `typed-${now}`, text, role: 'user', firstReceivedTime: now }]);
    await send(text);
  };

  const handleToggleMute = async () => {
    const next = !agentMuted;
    setAgentMuted(next);
    await room.localParticipant.sendText(String(next), { topic: 'agent_audio_muted' });
  };

  const moodKey = mood === AgentMoodEnum.FRENCH ? 'french' : 'english';
  const moodConfig = personaConfig.moods[moodKey];

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

      <div className="flex flex-col items-center mb-6 relative">
        <div className="flex flex-row">
          <Image
            src={moodConfig.avatarImage}
            alt={`${moodConfig.label} Avatar`}
            width={254}
            height={254}
            className="rounded-none md:w-[254px] md:h-[254px] w-[200px] h-[200px]"
            priority
          />
          <div
            className="mt-[64px] w-[64px] h-[64px] rounded-full flex justify-center items-center relative overflow-hidden"
            style={{ backgroundColor: moodConfig.visualizerBgColor }}
          >
            <AudioVisualizer
              state={agentState === 'speaking' && !agentMuted ? 'speaking' : 'idle'}
              variant={moodConfig.visualizerVariant}
            />
          </div>
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col items-center overflow-hidden z-10">
        <TranscriptionView mood={mood} combinedTranscriptions={combinedTranscriptions} />
      </div>

      <RoomAudioRenderer muted={agentMuted} />
      <NoAgentNotification state={agentState} />

      {/* Centered controls at the bottom - Fixed */}
      {!ended && (
        <div className="w-full flex flex-col items-center fixed bottom-0 left-0 px-4 py-8 z-10 gap-4">
          <form onSubmit={handleSend} className="w-full md:w-[700px] flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={moodConfig.inputPlaceholder}
              aria-label={moodConfig.inputPlaceholder}
              className="flex-1 h-[48px] rounded-xl bg-white/90 shadow-lg px-4 text-[#273339] font-inter outline-none focus:ring-2 focus:ring-[#A15EED]"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-[48px] px-5 rounded-xl text-white font-inter shadow-lg disabled:opacity-50"
              style={{ backgroundColor: moodConfig.visualizerBgColor }}
            >
              {moodConfig.sendLabel}
            </button>
          </form>

          <div className="flex justify-center gap-4">
            <div className="flex flex-row items-center gap-4 bg-white/90 rounded-xl shadow-lg py-3">
              <CustomVoiceAssistantControlBar controls={{ leave: false }} />
            </div>
            <div className="flex items-center gap-4 bg-white/90 rounded-xl shadow-lg px-3 py-3">
              <button
                className="h-[40px] flex items-center justify-center gap-2 px-4 rounded-lg text-[#273339]"
                onClick={handleToggleMute}
                aria-pressed={agentMuted}
                title={agentMuted ? moodConfig.unmuteLabel : moodConfig.muteLabel}
              >
                <SpeakerIcon muted={agentMuted} />
                {!isPhone && (agentMuted ? moodConfig.unmuteLabel : moodConfig.muteLabel)}
              </button>
            </div>
            <div className="flex items-center gap-4 bg-white/90 rounded-xl shadow-lg px-3 py-3">
              <button
                className="h-[40px] flex items-center justify-center gap-2 px-6"
                onClick={handleEndConversation}
                disabled={loading}
                style={{
                  backgroundColor: '#F06444',
                  borderRadius: '8px',
                  border: 'none',
                  color: 'white',
                }}
              >
                {loading ? <Loader color="white" /> : <CloseIcon />}
                {!isPhone && 'End'}
              </button>
            </div>
          </div>

          <div className="text-sm md:text-base text-grey-7 font-inter text-center">{moodConfig.endHint}</div>
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
                onClick={() => router.push('/')}
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
    {muted ? (
      <path d="m23 9-6 6M17 9l6 6" strokeLinecap="round" />
    ) : (
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" strokeLinecap="round" />
    )}
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
