'use client';

import {
  IDLE_PROMPT,
  QuickReplyNode,
  latestVideoAsk,
  quickReplyBackLabel,
  quickReplyTree,
} from '@/config/quickReplies.config';
import type { Transcription } from '@/hooks/useCombinedTranscriptions';
import type { AgentMoodI } from '@/types/agent';
import { useEffect, useState } from 'react';

const QUICK_PREFIX = 'quick-';

/**
 * Where the options show from: the id of the greeting or of the agent's latest
 * idle check-in, or null once the user has asked something since then (a leaf,
 * a typed or a spoken message). Branch picks don't count, so the tree stays
 * open while the user walks it.
 */
export function quickRepliesAnchor(messages: Transcription[]): string | null {
  let anchor = -1;
  messages.forEach((m, i) => {
    if (m.id === 'local-greeting' || (m.role === 'assistant' && IDLE_PROMPT.test(m.text))) anchor = i;
  });
  if (anchor === -1) return null;
  const asked = messages.slice(anchor + 1).some(m => m.role === 'user' && !m.id.startsWith(QUICK_PREFIX));
  return asked ? null : messages[anchor].id;
}

// One lookup per language per page load, shared by every remount of the chips.
const latestVideoRequests = new Map<AgentMoodI, Promise<string | null>>();

function fetchLatestVideoTitle(mood: AgentMoodI) {
  let request = latestVideoRequests.get(mood);
  if (!request) {
    request = fetch(`/api/latest-video?lang=${mood}`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => (body?.video?.title as string | undefined) ?? null)
      .catch(() => null);
    latestVideoRequests.set(mood, request);
  }
  return request;
}

/** Title of the newest session recording in this language's bonfire, once loaded. */
function useLatestVideoTitle(mood: AgentMoodI) {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchLatestVideoTitle(mood).then(t => live && setTitle(t));
    return () => {
      live = false;
    };
  }, [mood]);
  return title;
}

/** A branch pick and its canned reply, as two local chat messages. */
function branchMessages(label: string, reply: string): Transcription[] {
  const now = Date.now();
  return [
    { id: `${QUICK_PREFIX}user-${now}`, text: label, role: 'user', firstReceivedTime: now, local: true },
    { id: `${QUICK_PREFIX}reply-${now}`, text: reply, role: 'assistant', firstReceivedTime: now + 1, local: true },
  ];
}

/**
 * Option chips that walk the tree in quickReplies.config.ts, shown under the
 * agent's latest message. Remount (new key) to start again from the top.
 */
export function QuickReplies({
  mood,
  onBranch,
  onAsk,
  disabled,
}: {
  mood: AgentMoodI;
  // Adds a branch pick and its canned reply to the chat.
  onBranch: (messages: Transcription[]) => void;
  // Sends a leaf's question to the agent.
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  const [path, setPath] = useState<QuickReplyNode[]>([]);
  const latestVideo = useLatestVideoTitle(mood);
  const current = path[path.length - 1];
  const options = current && 'children' in current ? current.children : quickReplyTree;

  const pick = (node: QuickReplyNode) => {
    if ('ask' in node) return onAsk(node.ask[mood]);
    onBranch(branchMessages(node.label[mood], node.reply[mood]));
    setPath(prev => [...prev, node]);
  };

  return (
    // One row that scrolls sideways (touch or trackpad) with the scrollbar
    // hidden; the padding keeps chip shadows and focus rings from clipping.
    <div className="-mx-1 flex max-w-full flex-nowrap gap-2 self-start overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {path.length > 0 && (
        <button
          type="button"
          onClick={() => setPath(prev => prev.slice(0, -1))}
          disabled={disabled}
          aria-label={quickReplyBackLabel[mood]}
          title={quickReplyBackLabel[mood]}
          className="h-8 w-8 shrink-0 rounded-full border border-[#E4EAEB] bg-white text-[#5B676D] flex items-center justify-center shadow-sm transition-colors hover:bg-[#F5F5F5] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
        >
          <BackArrowIcon />
        </button>
      )}
      {path.length === 0 && latestVideo && (
        <button
          type="button"
          onClick={() => onAsk(latestVideoAsk(latestVideo)[mood])}
          disabled={disabled}
          title={latestVideo}
          className="h-8 max-w-[14rem] shrink-0 truncate whitespace-nowrap rounded-full border border-[#A15EED]/40 bg-white px-3 text-sm text-[#A15EED] font-inter shadow-sm transition-colors hover:bg-[#A15EED]/10 disabled:cursor-not-allowed disabled:hover:bg-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
        >
          {latestVideo}
        </button>
      )}
      {options.map(node => (
        <button
          key={node.id}
          type="button"
          onClick={() => pick(node)}
          disabled={disabled || node.disabled}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-[#A15EED]/40 bg-white px-3 text-sm text-[#A15EED] font-inter shadow-sm transition-colors hover:bg-[#A15EED]/10 disabled:cursor-not-allowed disabled:hover:bg-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A15EED]"
        >
          {node.label[mood]}
        </button>
      ))}
    </div>
  );
}

const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
