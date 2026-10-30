import { VOICE_AGENT, voiceSessions } from '@/config/agents.config';
import { requireMember } from '@/lib/auth';
import { ensureWalletKey } from '@/lib/wallet';
import { AgentMoodEnum } from '@/types/agent';
import crypto from 'crypto';
import { jwtVerify } from 'jose';
import { AccessToken, AccessTokenOptions, AgentDispatchClient, VideoGrant } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
// The voice agent registers under this name and joins only rooms it is dispatched to.
const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME ?? 'dev3pack_instructor';

// Voice session JWT gate — if set, requires a valid session token from Delve
const VOICE_SESSION_JWT_SECRET = process.env.VOICE_SESSION_JWT_SECRET;

// Single-use JTI enforcement: consumed tokens cannot be replayed
const consumedJtis = new Set<string>();

// Periodically clear consumed JTIs to prevent unbounded memory growth
const JTI_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  consumedJtis.clear();
}, JTI_CLEANUP_INTERVAL_MS);

// don't cache the results
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function GET(request: Request) {
  // Only signed-in fleet members may open a voice room.
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  try {
    const { searchParams } = new URL(request.url);

    // --- x402 Session Gate ---
    if (VOICE_SESSION_JWT_SECRET) {
      const sessionToken =
        searchParams.get('session_token') || request.headers.get('authorization')?.replace('Bearer ', '');

      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Payment required', detail: 'A valid session_token is required to access this voice agent.' },
          { status: 402 }
        );
      }

      try {
        const secret = new TextEncoder().encode(VOICE_SESSION_JWT_SECRET);
        const { payload } = await jwtVerify(sessionToken, secret, { algorithms: ['HS256'] });

        if (payload.session_type !== 'voice') {
          return NextResponse.json(
            { error: 'Invalid token', detail: 'Token is not a voice session token.' },
            { status: 401 }
          );
        }

        const jti = payload.jti;
        if (!jti) {
          return NextResponse.json({ error: 'Invalid token', detail: 'Token missing jti claim.' }, { status: 401 });
        }

        if (consumedJtis.has(jti)) {
          return NextResponse.json(
            { error: 'Token already used', detail: 'This session token has already been consumed.' },
            { status: 409 }
          );
        }

        // Mark as consumed (single-use)
        consumedJtis.add(jti);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Token verification failed';
        const isExpired = message.includes('exp');
        return NextResponse.json(
          { error: isExpired ? 'Token expired' : 'Invalid token', detail: message },
          { status: 401 }
        );
      }
    }
    // --- End Gate ---

    const mood = searchParams.get('mood');
    if (mood !== AgentMoodEnum.ENGLISH && mood !== AgentMoodEnum.SPANISH) {
      return NextResponse.json({ error: 'Unknown language' }, { status: 400 });
    }
    const voiceSession = voiceSessions[searchParams.get('agent') ?? VOICE_AGENT];
    if (!voiceSession) {
      return NextResponse.json({ error: 'Unknown agent' }, { status: 400 });
    }

    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // The agent spends from the member's own OpenRouter key and has none of its own.
    let openrouterKey: string;
    try {
      openrouterKey = await ensureWalletKey(member.email);
    } catch (err) {
      console.error('wallet provisioning failed', err);
      return NextResponse.json({ error: 'Your OpenRouter wallet is not ready yet.' }, { status: 503 });
    }

    // Generate participant token
    const participantIdentity = `voice_assistant_user_${crypto.randomUUID().replace(/-/g, '')}`;
    const roomName = `${mood}_room_${crypto.randomUUID().replace(/-/g, '')}`;
    const participantToken = await createParticipantToken({ identity: participantIdentity }, roomName);

    // Dispatched from here, not through the participant token or room metadata, since
    // the browser can read both; only the agent's job sees the dispatch metadata.
    await new AgentDispatchClient(LIVEKIT_URL, API_KEY, API_SECRET).createDispatch(roomName, AGENT_NAME, {
      metadata: JSON.stringify({
        openrouter_api_key: openrouterKey,
        persona: voiceSession.persona,
        language: mood,
        mcp_server: voiceSession.mcpServer[mood],
      }),
    });

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName: participantIdentity,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string) {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}
