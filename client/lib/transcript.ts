import { mergeConsecutiveSegments, sanitizeText } from '@/components/TranscriptionView';
import { personaConfig } from '@/config/persona.config';
import type { Transcription } from '@/hooks/useCombinedTranscriptions';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';

// Downloads the conversation as Markdown: a title and details, then one
// section per message. The agent's replies are kept as the Markdown it wrote.
export function downloadTranscript({
  messages,
  mood,
  agentName,
  title,
  filePrefix,
}: {
  messages: Transcription[];
  mood: AgentMoodI;
  agentName: string;
  title: string;
  filePrefix: string;
}) {
  const moodConfig = personaConfig.moods[mood === AgentMoodEnum.SPANISH ? 'spanish' : 'english'];
  const card = moodConfig.endCard;
  const started = messages[0]?.firstReceivedTime ?? Date.now();
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sections = mergeConsecutiveSegments(messages).map(segment => {
    const speaker = segment.role === 'assistant' ? agentName : card.transcriptYou;
    return `### ${speaker} · ${time(segment.firstReceivedTime)}\n\n${sanitizeText(segment.text).trim()}`;
  });
  const markdown = [
    `# ${title}`,
    `**${card.transcriptLanguage}:** ${moodConfig.label}  \n**${card.transcriptDate}:** ${new Date(started).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}`,
    '---',
    ...sections,
  ].join('\n\n');

  const blob = new Blob([`${markdown}\n`], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filePrefix}-${new Date(started).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
