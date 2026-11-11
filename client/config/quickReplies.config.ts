import { AgentMoodEnum, AgentMoodI } from '@/types/agent';

type ByMood<T> = Record<AgentMoodI, T>;

/**
 * The quick-option tree shown under the agent's latest message. It only helps
 * the user ask a question:
 * - a branch posts its label and an instant canned `reply` (client-side, the
 *   agent never sees it), then its children become the next options;
 * - a leaf sends its `ask` to the agent as the user's message, and the agent
 *   answers it like any typed question.
 */
export type QuickReplyNode = {
  id: string;
  label: ByMood<string>;
  // Shown greyed out and not clickable until switched back on.
  disabled?: boolean;
} & ({ reply: ByMood<string>; children: QuickReplyNode[] } | { ask: ByMood<string> });

const both = (english: string, spanish: string): ByMood<string> => ({
  [AgentMoodEnum.ENGLISH]: english,
  [AgentMoodEnum.SPANISH]: spanish,
});

export const quickReplyTree: QuickReplyNode[] = [
  {
    id: 'learn',
    label: both('Learn', 'Aprender'),
    reply: both('What would you like to know?', '¿Qué te gustaría saber?'),
    children: [
      {
        id: 'bootcamp-info',
        label: both('Bootcamp info', 'Info del bootcamp'),
        ask: both('Tell me more about the bootcamp', 'Cuéntame más sobre el bootcamp'),
      },
      {
        id: 'homework',
        label: both('Homework', 'Tareas'),
        ask: both('Tell me about the homework', 'Cuéntame sobre las tareas'),
      },
      {
        id: 'environment',
        label: both('Environment setup', 'Configurar entorno'),
        ask: both('How do I set up my development environment?', '¿Cómo configuro mi entorno de desarrollo?'),
      },
      {
        id: 'sessions',
        label: both('Sessions', 'Sesiones'),
        reply: both('Which session?', '¿Qué sesión?'),
        children: [
          {
            id: 'rust',
            label: both('Rust', 'Rust'),
            ask: both('What was covered in the Rust session?', '¿Qué se vio en la sesión de Rust?'),
          },
          {
            id: 'solana',
            label: both('Solana', 'Solana'),
            ask: both('What was covered in the Solana session?', '¿Qué se vio en la sesión de Solana?'),
          },
          {
            id: 'anchor',
            label: both('Anchor', 'Anchor'),
            ask: both('What was covered in the Anchor session?', '¿Qué se vio en la sesión de Anchor?'),
          },
        ],
      },
    ],
  },
  {
    id: 'build',
    label: both('Build', 'Construir'),
    ask: both('Help me build my project', 'Ayúdame a construir mi proyecto'),
    disabled: true,
  },
  {
    id: 'accelerate',
    label: both('Accelerate', 'Acelerar'),
    ask: both('How can I take my project further?', '¿Cómo puedo llevar mi proyecto más lejos?'),
    disabled: true,
  },
];

export const quickReplyBackLabel = both('Back', 'Atrás');

// The voice agent's idle check-in ("Hello?! Are you still there!?"). It is
// written by the LLM, so it is matched loosely; one brings the options back.
export const IDLE_PROMPT = /still there|are you there|sigues ah[ií]|est[aá]s ah[ií]/i;

// The root's first option: the newest session recording in the bonfire
// (/api/latest-video), labelled with its title and asked about by name.
export const latestVideoAsk = (title: string) =>
  both(
    `I want to learn more about the "${title}" session recording`,
    `Quiero saber más sobre la grabación de la sesión "${title}"`
  );
