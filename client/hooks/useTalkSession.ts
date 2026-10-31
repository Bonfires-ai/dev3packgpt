'use client';

import type { ConnectionDetails } from '@/app/api/connection-details/route';
import type { AgentMoodI } from '@/types/agent';
import { track } from '@vercel/analytics';
import { Room, RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAYMENTS_DISABLED = process.env.NEXT_PUBLIC_DISABLE_X402 === 'true';

// When true, a session needs a JWT from /api/paid/voice/session. In free mode
// (NEXT_PUBLIC_DISABLE_X402=true) that endpoint mints one without payment, so
// the session can start straight from the home page. Paid mode goes through
// the <PaymentGate /> on /talk first.
export const PAYMENT_GATE_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_GATE === 'true' || PAYMENTS_DISABLED;
export const NEEDS_PAYMENT = PAYMENT_GATE_ENABLED && !PAYMENTS_DISABLED;

export type TalkStatus = 'idle' | 'connecting' | 'connected' | 'ended';

async function fetchFreeSessionToken(): Promise<string> {
  const response = await fetch('/api/paid/voice/session', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.session_token) {
    throw new Error(body.error ?? `Could not start a session (${response.status})`);
  }
  return body.session_token;
}

// A short, plain message for the UI; the raw error goes to the console.
const START_ERROR = "Couldn't start the session. Please try again.";

/**
 * Owns one LiveKit room per session: start() fetches the connection details
 * and connects, with the mic off until the user unmutes it in the room; the
 * status stays 'connecting' until that is done, so callers show a single
 * loading state.
 */
export function useTalkSession() {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<TalkStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  const start = useCallback(async (mood: AgentMoodI, agent: string, sessionToken?: string | null) => {
    setError(null);
    setStatus('connecting');
    track('conversation_started', { mood });

    const newRoom = new Room();
    roomRef.current = newRoom;
    let roomId: string | undefined;

    // The room's mic button asks again and explains a blocked or missing mic.
    newRoom.on(RoomEvent.MediaDevicesError, err => console.error(err));
    // However the session ends (agent hangs up, network drop), show the end card.
    newRoom.on(RoomEvent.Disconnected, () => {
      newRoom.removeAllListeners();
      setStatus(prev => (prev === 'idle' ? prev : 'ended'));
    });

    try {
      const token = sessionToken ?? (PAYMENTS_DISABLED ? await fetchFreeSessionToken() : null);

      const params = new URLSearchParams({ mood, agent });
      if (token) params.set('session_token', token);
      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
        window.location.origin
      );
      const response = await fetch(`${url.toString()}?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(body.detail || body.error || `Connection failed (${response.status})`);
      }
      const details: ConnectionDetails = await response.json();
      roomId = details.roomName?.split('_')[2]; // format is: <mood>_room_<roomId>

      // The agent sends this from end_session; the end-of-session card always follows.
      newRoom.registerTextStreamHandler('conversation_ended', async reader => {
        await reader.readAll();
        track('conversation_ended', { roomId: roomId ?? null, mood });
        newRoom.disconnect();
      });
      newRoom.registerTextStreamHandler('agent_version', async reader => {
        console.log(`CurrentVersion: ${await reader.readAll()}`);
      });

      await newRoom.connect(details.serverUrl, details.participantToken);
      await newRoom.startAudio().catch(() => undefined);

      setRoom(newRoom);
      setStatus('connected');
    } catch (err) {
      console.error('Error connecting to room', err);
      newRoom.removeAllListeners();
      newRoom.disconnect();
      roomRef.current = null;
      setError(START_ERROR);
      setStatus('idle');
    }
  }, []);

  const reset = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRoom(null);
    setError(null);
    setStatus('idle');
  }, []);

  // Leave the room if the page unmounts mid-session.
  useEffect(() => () => void roomRef.current?.disconnect(), []);

  return { room, status, error, start, reset };
}
