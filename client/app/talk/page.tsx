'use client';

import LoadingPage from '@/components/LoadingPage';
import { PaymentGate } from '@/components/PaymentGate';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { personaConfig } from '@/config/persona.config';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import { RoomContext } from '@livekit/components-react';
import { track } from '@vercel/analytics';
import { Room, RoomEvent } from 'livekit-client';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionDetails } from '../api/connection-details/route';

// When true, render <PaymentGate /> (which calls /api/paid/voice/session for a JWT).
// Free-session mode (NEXT_PUBLIC_DISABLE_X402=true) still needs the gate so we
// can mint the JWT that /api/connection-details requires when VOICE_SESSION_JWT_SECRET is set.
const PAYMENTS_DISABLED = process.env.NEXT_PUBLIC_DISABLE_X402 === 'true';
const PAYMENT_GATE_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_GATE === 'true' || PAYMENTS_DISABLED;

const parseMoodQueryParam = (query: string | string[] | null): AgentMoodI | null => {
  if (typeof query === 'string') {
    return query as AgentMoodI;
  }
  return null;
};

const TalkComponent = () => {
  const searchParams = useSearchParams();
  const mood = parseMoodQueryParam(searchParams.get('mood'));
  const router = useRouter();

  const [room] = useState(new Room());
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const isInitialRender = useRef(false);

  // Payment gate state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(!PAYMENT_GATE_ENABLED);

  const [isConversationEnded, setIsConversationEnded] = useState(false);

  const [roomId, setRoomId] = useState<string | null>(null);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Error requesting microphone permission', error);
    }
  };

  const handleSessionReady = useCallback((token: string) => {
    setSessionToken(token);
    setPaymentComplete(true);
  }, []);

  async function connect(token?: string | null) {
    try {
      setConnecting(true);
      requestMicrophonePermission();

      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
        window.location.origin
      );

      // Build query params
      const params = new URLSearchParams();
      if (mood) params.set('mood', mood);
      if (token) params.set('session_token', token);

      const response = await fetch(`${url.toString()}?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(body.detail || body.error || `Connection failed (${response.status})`);
      }

      const connectionDetailsData: ConnectionDetails = await response.json();

      if (connectionDetailsData.roomName) {
        setRoomId(connectionDetailsData.roomName.split('_')[2]); // format is: <mood>_room_<roomId>
      }

      await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);

      // The agent sends this from end_conversation; the end-of-session card always follows.
      room.registerTextStreamHandler('conversation_ended', async reader => {
        await reader.readAll();
        setIsConversationEnded(true);
        room.disconnect();
        track('conversation_ended', { roomId: roomId, mood });
      });

      room.registerTextStreamHandler('agent_version', async (reader, participantInfo) => {
        for await (const chunk of reader) {
          // Logs agent version
          console.log(`CurrentVersion: ${chunk}`);
        }
      });

      setConnected(true);
      setConnecting(false);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error('Error connecting to room', error);
      setConnecting(false);
    }
  }

  useEffect(() => {
    // redirect to home page if no mood is selected
    if (!mood) {
      router.push('/');
    }
  }, [mood, router]);

  // Connect to LiveKit when mood is selected AND payment is complete
  useEffect(() => {
    if (!mood) return;
    if (!paymentComplete) return;
    if (isInitialRender.current) return;

    connect(sessionToken);
    isInitialRender.current = true;
    console.log('connecting to room...');
    return () => {
      console.log('clean up ran');
    };
  }, [room, mood, paymentComplete, sessionToken]);

  useEffect(() => {
    room.on(RoomEvent.MediaDevicesError, onDeviceFailure);

    // However the session ends (agent hangs up, network drop), show the end card.
    const handleDisconnected = () => {
      room.removeAllListeners();
      setIsConversationEnded(true);
      console.log('Disconnected from room');
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  // Persona selection UI
  if (!mood) {
    return <></>;
  }

  // Payment gate — show before voice session
  if (!paymentComplete && PAYMENT_GATE_ENABLED) {
    return <PaymentGate mood={mood} onSessionReady={handleSessionReady} />;
  }

  // Show loading state while connecting
  if (connecting && !connected) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F5F5] relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center gap-4">
          <div className="text-[#171D21] text-lg md:text-2xl font-bold mb-4 px-8 md:px-0 text-center font-inter tracking-[0.05em]">
            Connecting to {personaConfig.moods[mood === AgentMoodEnum.ENGLISH ? 'english' : 'french'].connectingLabel}
            ...
          </div>
          <div className="w-10 h-10 border-3 border-[#A15EED]/40 border-t-[#A15EED] rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  // Voice assistant UI
  return (
    <main data-lk-theme="default" className="h-full grid content-center bg-[#F5F5F5]">
      <RoomContext.Provider value={room}>
        <div className="lk-room-container max-h-[90vh]">
          <VoiceAssistant mood={mood} ended={isConversationEnded} />
        </div>
      </RoomContext.Provider>
    </main>
  );
};

export default function TalkPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <TalkComponent />
    </Suspense>
  );
}

function onDeviceFailure(error: Error) {
  console.error(error);
  alert(
    'Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab'
  );
}
