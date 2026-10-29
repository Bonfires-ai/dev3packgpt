'use client';

import { personaConfig } from '@/config/persona.config';
import { AgentMoodI } from '@/types/agent';
import { useEffect, useRef, useState } from 'react';

/** Asks a signed-out visitor to sign in before chatting; shows a failed sign-in here too. */
export function SignInDialog({
  mood,
  error,
  onSignIn,
  onClose,
}: {
  mood: AgentMoodI;
  error?: string | null;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const text = personaConfig.moods[mood].signIn;
  const ref = useRef<HTMLDialogElement>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="signin-dialog-title"
      className="w-[min(360px,calc(100vw-2rem))] bg-white p-6 font-inter text-left shadow-xl backdrop:bg-black/40"
    >
      <h2 id="signin-dialog-title" className="text-lg font-semibold text-[#171D21]">
        {text.title}
      </h2>
      <p className="mt-2 text-sm text-[#5C686D]">{text.body}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#DC2626]">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="h-10 px-4 text-sm font-medium text-[#5C686D] hover:text-[#171D21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
        >
          {text.cancel}
        </button>
        <button
          type="button"
          autoFocus
          disabled={redirecting}
          onClick={() => {
            setRedirecting(true);
            onSignIn();
          }}
          className="h-10 px-5 text-sm font-semibold text-white bg-[#A15EED] hover:bg-[#7C3AED] disabled:opacity-70 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A15EED]"
        >
          {redirecting ? text.redirecting : text.signIn}
        </button>
      </div>
    </dialog>
  );
}
