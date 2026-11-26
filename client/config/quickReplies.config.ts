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

const all = (english: string, spanish: string, turkish: string, ukrainian: string): ByMood<string> => ({
  [AgentMoodEnum.ENGLISH]: english,
  [AgentMoodEnum.SPANISH]: spanish,
  [AgentMoodEnum.TURKISH]: turkish,
  [AgentMoodEnum.UKRAINIAN]: ukrainian,
});

export const quickReplyTree: QuickReplyNode[] = [
  {
    id: 'learn',
    label: all('Learn', 'Aprender', 'Öğren', 'Навчатися'),
    reply: all(
      'What would you like to know?',
      '¿Qué te gustaría saber?',
      'Ne öğrenmek istersin?',
      'Що ти хочеш дізнатися?'
    ),
    children: [
      {
        id: 'bootcamp-info',
        label: all('Bootcamp info', 'Info del bootcamp', 'Bootcamp bilgisi', 'Про буткемп'),
        ask: all(
          'Tell me more about the bootcamp',
          'Cuéntame más sobre el bootcamp',
          'Bana bootcamp hakkında daha fazla bilgi ver',
          'Розкажи більше про буткемп'
        ),
      },
      {
        id: 'homework',
        label: all('Homework', 'Tareas', 'Ödevler', 'Домашні завдання'),
        ask: all(
          'Tell me about the homework',
          'Cuéntame sobre las tareas',
          'Bana ödevlerden bahset',
          'Розкажи про домашні завдання'
        ),
      },
      {
        id: 'environment',
        label: all('Environment setup', 'Configurar entorno', 'Ortam kurulumu', 'Налаштування середовища'),
        ask: all(
          'How do I set up my development environment?',
          '¿Cómo configuro mi entorno de desarrollo?',
          'Geliştirme ortamımı nasıl kurarım?',
          'Як налаштувати середовище розробки?'
        ),
      },
      {
        id: 'sessions',
        label: all('Sessions', 'Sesiones', 'Oturumlar', 'Заняття'),
        reply: all('Which session?', '¿Qué sesión?', 'Hangi oturum?', 'Яке заняття?'),
        children: [
          {
            id: 'rust',
            label: all('Rust', 'Rust', 'Rust', 'Rust'),
            ask: all(
              'What was covered in the Rust session?',
              '¿Qué se vio en la sesión de Rust?',
              'Rust oturumunda neler işlendi?',
              'Що розбирали на занятті з Rust?'
            ),
          },
          {
            id: 'solana',
            label: all('Solana', 'Solana', 'Solana', 'Solana'),
            ask: all(
              'What was covered in the Solana session?',
              '¿Qué se vio en la sesión de Solana?',
              'Solana oturumunda neler işlendi?',
              'Що розбирали на занятті з Solana?'
            ),
          },
          {
            id: 'anchor',
            label: all('Anchor', 'Anchor', 'Anchor', 'Anchor'),
            ask: all(
              'What was covered in the Anchor session?',
              '¿Qué se vio en la sesión de Anchor?',
              'Anchor oturumunda neler işlendi?',
              'Що розбирали на занятті з Anchor?'
            ),
          },
        ],
      },
    ],
  },
  {
    id: 'build',
    label: all('Build', 'Construir', 'Geliştir', 'Створювати'),
    ask: all(
      'Help me build my project',
      'Ayúdame a construir mi proyecto',
      'Projemi geliştirmeme yardım et',
      'Допоможи мені створити мій проєкт'
    ),
    disabled: true,
  },
  {
    id: 'accelerate',
    label: all('Accelerate', 'Acelerar', 'Hızlandır', 'Прискорити'),
    ask: all(
      'How can I take my project further?',
      '¿Cómo puedo llevar mi proyecto más lejos?',
      'Projemi nasıl daha ileri taşıyabilirim?',
      'Як розвинути мій проєкт далі?'
    ),
    disabled: true,
  },
];

export const quickReplyBackLabel = all('Back', 'Atrás', 'Geri', 'Назад');

// The voice agent's idle check-in ("Hello?! Are you still there!?"). It is
// written by the LLM, so it is matched loosely; one brings the options back.
export const IDLE_PROMPT =
  /still there|are you there|sigues ah[ií]|est[aá]s ah[ií]|orada m[ıi]s[ıi]n|hâlâ orada|hala orada|ти тут|ви тут|ще тут/i;

// The root's first option: the newest session recording in the bonfire
// (/api/latest-video), labelled with its title and asked about by name.
export const latestVideoAsk = (title: string) =>
  all(
    `I want to learn more about the "${title}" session recording`,
    `Quiero saber más sobre la grabación de la sesión "${title}"`,
    `"${title}" oturum kaydı hakkında daha fazla bilgi almak istiyorum`,
    `Я хочу дізнатися більше про запис заняття "${title}"`
  );
