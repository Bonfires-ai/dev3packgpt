'use client';

import { findSaltsAgent } from '@/config/salts.config';
import type { Transcription } from '@/hooks/useCombinedTranscriptions';
import type { TalkStatus } from '@/hooks/useTalkSession';
import type { AgentMoodI } from '@/types/agent';
import { track } from '@vercel/analytics';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ActiveSession {
  agent: string;
  sessionId: string;
  // Picks the agent's MCP server for that language on every message.
  mood: AgentMoodI;
}

// The server deletes the Salts session; keepalive lets it finish while the page unloads.
function destroySession({ agent, sessionId }: ActiveSession) {
  return fetch(`/api/salts/sessions/${encodeURIComponent(sessionId)}?agent=${encodeURIComponent(agent)}`, {
    method: 'DELETE',
    keepalive: true,
  }).catch(() => undefined);
}

// Some models, near their tool-round limit, write a tool call out as text in
// their own markup. It is never part of the answer; Salts cuts it the same way.
const cleanReply = (text: string) => text.replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, '').trim();

/** Reads `data: {json}` events off a server-sent event stream. */
async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = event
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('');
      if (data) yield JSON.parse(data) as { type: string; text?: string; error?: string };
    }
  }
}

/**
 * The text counterpart of useTalkSession, for a Salts agent: start() opens one
 * Salts session, send() streams each reply into `messages`, and end() destroys
 * the session. Leaving the page destroys it too, so no session outlives its chat.
 */
export function useTextSession() {
  const [status, setStatus] = useState<TalkStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Transcription[]>([]);
  const [thinking, setThinking] = useState(false);
  const [replying, setReplying] = useState(false);
  const sessionRef = useRef<ActiveSession | null>(null);
  const replyAbort = useRef<AbortController | null>(null);

  const start = useCallback(async (agentSlug: string, mood: AgentMoodI) => {
    const agent = findSaltsAgent(agentSlug);
    if (!agent) return;
    setError(null);
    setStatus('connecting');
    track('conversation_started', { agent: agent.slug });
    try {
      const res = await fetch('/api/salts/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agent.slug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.sessionId) throw new Error(body.error ?? `Could not start a session (${res.status})`);
      sessionRef.current = { agent: agent.slug, sessionId: body.sessionId, mood };
      setMessages([
        { id: 'local-greeting', text: agent.greeting, role: 'assistant', firstReceivedTime: Date.now(), local: true },
      ]);
      setStatus('connected');
    } catch (err) {
      console.error('Error starting text session', err);
      setError("Couldn't start the session. Please try again.");
      setStatus('idle');
    }
  }, []);

  const send = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session) return;
    const now = Date.now();
    setMessages(prev => [...prev, { id: `user-${now}`, text, role: 'user', firstReceivedTime: now, local: true }]);
    setThinking(true);
    setReplying(true);

    const abort = new AbortController();
    replyAbort.current = abort;
    // One bubble per round, as the Salts UI shows it: what the agent says before
    // a tool call ("let me search…") stays apart from what it says after, so each
    // keeps its own Markdown. A tool call closes the round's bubble.
    let round = 0;
    let raw = '';
    let open = false;
    const appendReply = (chunk: string) => {
      const id = `assistant-${now}-${round}`;
      raw += chunk;
      open = true;
      const text = cleanReply(raw);
      setMessages(prev => {
        const at = prev.findIndex(m => m.id === id);
        if (!text) return at === -1 ? prev : prev.filter(m => m.id !== id);
        if (at !== -1) return prev.map(m => (m.id === id ? { ...m, text } : m));
        return [...prev, { id, text, role: 'assistant', firstReceivedTime: Date.now(), local: true }];
      });
    };
    const closeRound = () => {
      if (!open) return;
      open = false;
      raw = '';
      round++;
    };

    try {
      const res = await fetch(`/api/salts/sessions/${encodeURIComponent(session.sessionId)}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: session.agent, message: text, mood: session.mood }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Reply failed (${res.status})`);
      }
      for await (const event of readEvents(res.body)) {
        if (event.type === 'delta' && event.text) {
          setThinking(false);
          appendReply(event.text);
        } else if (event.type === 'tool') {
          closeRound();
          setThinking(true);
        } else if (event.type === 'error') {
          throw new Error(event.error ?? 'Reply failed');
        }
      }
    } catch (err) {
      if (abort.signal.aborted) return;
      console.error('Error streaming reply', err);
      closeRound();
      appendReply('_Something went wrong with this reply. Please try again._');
    } finally {
      if (replyAbort.current === abort) replyAbort.current = null;
      setThinking(false);
      setReplying(false);
    }
  }, []);

  const end = useCallback(async () => {
    replyAbort.current?.abort();
    const session = sessionRef.current;
    sessionRef.current = null;
    setThinking(false);
    setReplying(false);
    setStatus('ended');
    if (session) {
      track('conversation_ended', { agent: session.agent });
      await destroySession(session);
    }
  }, []);

  const reset = useCallback(() => {
    replyAbort.current?.abort();
    if (sessionRef.current) void destroySession(sessionRef.current);
    sessionRef.current = null;
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  // Closing the tab or leaving the page mid-chat destroys the session too.
  useEffect(() => {
    const leave = () => {
      if (sessionRef.current) void destroySession(sessionRef.current);
      sessionRef.current = null;
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      replyAbort.current?.abort();
      leave();
    };
  }, []);

  return { status, error, messages, thinking, replying, start, send, end, reset };
}
