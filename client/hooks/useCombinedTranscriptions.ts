import { useTrackTranscription, useVoiceAssistant } from '@livekit/components-react';
import { useEffect, useMemo, useRef } from 'react';
import useLocalMicTrack from './useLocalMicTrack';

export interface Transcription {
  id: string;
  text: string;
  role: 'assistant' | 'user';
  firstReceivedTime: number;
}

/**
 * Custom hook for combining agent and user transcriptions.
 *
 * This hook manages the combination of transcriptions from the voice assistant, the user's microphone,
 * and messages the user typed (which the agent does not echo back as transcriptions).
 * It provides a combined list of transcriptions sorted by the time they were first received.
 *
 * @returns {Transcription[]} Combined list of transcriptions
 */
export default function useCombinedTranscriptions(typedMessages: Transcription[] = []) {
  const { agentTranscriptions, state } = useVoiceAssistant();

  const backupTranscriptions = useRef<Transcription[]>([]);

  const micTrackRef = useLocalMicTrack();
  const { segments: userTranscriptions } = useTrackTranscription(micTrackRef);

  const combinedTranscriptions = useMemo<Transcription[]>(() => {
    return [
      ...agentTranscriptions.map(val => {
        return { ...val, role: 'assistant' };
      }),
      ...userTranscriptions.map(val => {
        return { ...val, role: 'user' };
      }),
      ...typedMessages,
    ].sort((a, b) => a.firstReceivedTime - b.firstReceivedTime);
  }, [agentTranscriptions, userTranscriptions, typedMessages]);

  useEffect(() => {
    if (state !== 'disconnected') {
      backupTranscriptions.current = combinedTranscriptions;
    }
  }, [state, combinedTranscriptions]);

  if (state === 'disconnected') {
    return backupTranscriptions.current;
  }

  return combinedTranscriptions;
}
