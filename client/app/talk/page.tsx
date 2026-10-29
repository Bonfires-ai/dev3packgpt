'use client';

import { ChatRoom } from '@/components/ChatRoom';
import LoadingPage from '@/components/LoadingPage';
import { PaymentGate } from '@/components/PaymentGate';
import { useAuth } from '@/hooks/useAuth';
import { NEEDS_PAYMENT, useTalkSession } from '@/hooks/useTalkSession';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef } from 'react';

const parseMoodQueryParam = (query: string | null): AgentMoodI | null =>
  query === AgentMoodEnum.ENGLISH || query === AgentMoodEnum.SPANISH ? query : null;

// Direct links (/talk?mood=english) and paid sessions land here. Free sessions
// normally start from the home page without leaving it.
const TalkComponent = () => {
  const searchParams = useSearchParams();
  const mood = parseMoodQueryParam(searchParams.get('mood'));
  const router = useRouter();
  const { room, status, error, start } = useTalkSession();
  const { loading: authLoading, signedIn, signIn } = useAuth();
  const started = useRef(false);

  const startOnce = useCallback(
    (token?: string) => {
      if (!mood || started.current) return;
      started.current = true;
      start(mood, token);
    },
    [mood, start]
  );

  useEffect(() => {
    // redirect to home page if no mood is selected
    if (!mood) router.push('/');
    else if (authLoading) return;
    // Signed-out visitors log in first and come back to this link.
    else if (!signedIn) signIn();
    else if (!NEEDS_PAYMENT) startOnce();
  }, [mood, router, startOnce, authLoading, signedIn, signIn]);

  if (!mood) return <></>;

  if (room && (status === 'connected' || status === 'ended')) {
    return <ChatRoom room={room} mood={mood} ended={status === 'ended'} onRestart={() => router.push('/')} />;
  }

  if (error) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[#F5F5F5] px-6 text-center font-inter">
        <p className="text-[#DC2626]">{error}</p>
        <button onClick={() => router.push('/')} className="underline text-[#5C686D] hover:text-[#A15EED]">
          Back to home
        </button>
      </main>
    );
  }

  // The gate stays up while the room connects: its "connecting" step is the only loading state.
  if (NEEDS_PAYMENT) return <PaymentGate mood={mood} onSessionReady={startOnce} />;

  return <LoadingPage />;
};

export default function TalkPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <TalkComponent />
    </Suspense>
  );
}
