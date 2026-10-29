import type { Transcription } from '@/hooks/useCombinedTranscriptions';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';
import { useVoiceAssistant } from '@livekit/components-react';
import clsx from 'clsx';
import * as React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const sanitizeText = (text: string) => {
  // Patch crypto jargon Deepgram spells out (safety net even with server-side
  // `replace` config, since smart_format misses some patterns). Markdown is
  // left in place: assistant bubbles render it.
  return text
    .replaceAll(/\bx\s+four\s+zero\s+two\b/gi, 'x402')
    .replaceAll(/\bERC\s+twenty\b/gi, 'ERC20')
    .replaceAll(/\bEIP\s+seven\s+twelve\b/gi, 'EIP-712');
};

interface Segment {
  id: string;
  text: string;
  role: 'assistant' | 'user';
  local?: boolean;
}

/**
 * Deepgram finalises a new segment each time the user pauses briefly, which
 * would render every breath as a separate bubble, so consecutive spoken user
 * segments merge into one. Each agent segment is a separate reply (e.g. "let
 * me check" before a search, then the answer) and typed messages are already
 * whole, so those keep their own bubbles.
 */
export const mergeConsecutiveSegments = <T extends Segment>(segments: T[]): T[] => {
  const merged: T[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.role === 'user' && seg.role === 'user' && !last.local && !seg.local) {
      last.text = `${last.text} ${seg.text}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
};

export default function TranscriptionView({
  mood,
  combinedTranscriptions,
  showThinking = true,
  header,
  footer,
}: {
  mood: AgentMoodI;
  combinedTranscriptions: Transcription[];
  showThinking?: boolean;
  // Rendered above the messages, inside the scroll area.
  header?: React.ReactNode;
  // Rendered after the messages, inside the scroll area.
  footer?: React.ReactNode;
}) {
  const { state } = useVoiceAssistant();

  const isThinking = showThinking && state === 'thinking';

  const lastScrolledID = React.useRef<string | null>(null);

  const mergedTranscriptions = React.useMemo(
    () => mergeConsecutiveSegments(combinedTranscriptions),
    [combinedTranscriptions]
  );

  // scroll to bottom when new transcription is added
  React.useEffect(() => {
    const transcription = mergedTranscriptions[mergedTranscriptions.length - 1];
    if (transcription && transcription.id !== lastScrolledID.current) {
      const transcriptionElement = document.getElementById(transcription.id);
      if (transcriptionElement) {
        transcriptionElement.scrollIntoView({ behavior: 'smooth' });
      }
    }

    if (isThinking) {
      const transcriptionElement = document.getElementById('agent-thinking');
      if (transcriptionElement) {
        transcriptionElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [mergedTranscriptions, isThinking]);

  const onlyAssistantTranscriptions = mergedTranscriptions.filter(segment => segment.role === 'assistant');
  const lastAssistantTranscription = onlyAssistantTranscriptions[onlyAssistantTranscriptions.length - 1];

  const onlyUserTranscriptions = mergedTranscriptions.filter(segment => segment.role === 'user');
  const lastUserTranscription = onlyUserTranscriptions[onlyUserTranscriptions.length - 1];

  const preventAutoScrollOnHumanScroll = () => {
    const transcription = mergedTranscriptions[mergedTranscriptions.length - 1];
    if (transcription) lastScrolledID.current = transcription.id;
  };

  return (
    <div
      className="h-full w-full overflow-y-auto overflow-x-hidden"
      onWheel={preventAutoScrollOnHumanScroll}
      onTouchStart={preventAutoScrollOnHumanScroll}
    >
      {header}
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 py-6">
        {mergedTranscriptions.map(segment => (
          <ChatBubble
            key={segment.id}
            id={segment.id}
            text={sanitizeText(segment.text)}
            role={segment.role}
            mood={mood}
            isLast={
              (!isThinking && segment.id === lastAssistantTranscription?.id) || segment.id === lastUserTranscription?.id
            }
          />
        ))}

        {isThinking && <ChatBubble id={'agent-thinking'} role={'assistant'} mood={mood} thinking isLast />}
        {footer}
      </div>
    </div>
  );
}

const ChatBubble = ({
  id,
  text,
  role,
  mood,
  thinking,
  isLast,
}: {
  id: string;
  text?: string;
  role: 'assistant' | 'user';
  mood: AgentMoodI;
  thinking?: boolean;
  isLast?: boolean;
}) => {
  return (
    <div
      id={id}
      className={clsx(
        role === 'assistant'
          ? `assistant-bubble rounded-2xl px-5 py-3 self-start max-w-[85%] md:max-w-[75%] shadow-sm text-[15px] md:text-base leading-relaxed bg-[#A15EED] text-white ${isLast ? 'rounded-tl-md' : ''}`
          : `user-bubble bg-white text-[#171D21] border border-[#E4EAEB] rounded-2xl px-5 py-3 self-end max-w-[85%] md:max-w-[75%] shadow-sm text-[15px] md:text-base leading-relaxed ${isLast ? 'rounded-br-md' : ''}`
      )}
      style={{ wordBreak: 'break-word', whiteSpace: role === 'user' ? 'pre-line' : undefined }}
    >
      {role === 'assistant' && text ? (
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {text}
        </Markdown>
      ) : (
        text
      )}

      {thinking && <div className={'rounded-full animate-pulse opacity-80'}>Thinking...</div>}
    </div>
  );
};

// Styles for markdown inside the purple assistant bubble. Links open in a new
// tab, since leaving the page would drop the live session.
const markdownComponents: Components = {
  p: ({ node, ...props }) => <p className="[&:not(:first-child)]:mt-3" {...props} />,
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 decoration-white/60 hover:decoration-white break-all"
    />
  ),
  ul: ({ node, ...props }) => <ul className="mt-2 list-disc pl-5 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="mt-2 list-decimal pl-5 space-y-1" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  h1: ({ node, ...props }) => <p className="font-semibold [&:not(:first-child)]:mt-3" {...props} />,
  h2: ({ node, ...props }) => <p className="font-semibold [&:not(:first-child)]:mt-3" {...props} />,
  h3: ({ node, ...props }) => <p className="font-semibold [&:not(:first-child)]:mt-3" {...props} />,
  code: ({ node, ...props }) => <code className="rounded bg-white/15 px-1 py-0.5 font-mono text-[0.9em]" {...props} />,
  pre: ({ node, ...props }) => <pre className="mt-2 overflow-x-auto rounded-lg bg-black/20 p-3 text-sm" {...props} />,
  blockquote: ({ node, ...props }) => <blockquote className="mt-2 border-l-2 border-white/50 pl-3" {...props} />,
};
