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

const all = (
  english: string,
  spanish: string,
  french: string,
  turkish: string,
  ukrainian: string,
  vietnamese: string
): ByMood<string> => ({
  [AgentMoodEnum.ENGLISH]: english,
  [AgentMoodEnum.SPANISH]: spanish,
  [AgentMoodEnum.FRENCH]: french,
  [AgentMoodEnum.TURKISH]: turkish,
  [AgentMoodEnum.UKRAINIAN]: ukrainian,
  [AgentMoodEnum.VIETNAMESE]: vietnamese,
});

export const quickReplyTree: QuickReplyNode[] = [
  {
    id: 'learn',
    label: all('Learn', 'Aprender', 'Apprendre', 'Öğren', 'Навчатися', 'Học'),
    reply: all(
      'What would you like to know?',
      '¿Qué te gustaría saber?',
      "Qu'aimerais-tu savoir ?",
      'Ne öğrenmek istersin?',
      'Що ти хочеш дізнатися?',
      'Bạn muốn biết điều gì?'
    ),
    children: [
      {
        id: 'bootcamp-info',
        label: all(
          'Bootcamp info',
          'Info del bootcamp',
          'Infos bootcamp',
          'Bootcamp bilgisi',
          'Про буткемп',
          'Thông tin bootcamp'
        ),
        ask: all(
          'Tell me more about the bootcamp',
          'Cuéntame más sobre el bootcamp',
          'Parle-moi du bootcamp',
          'Bana bootcamp hakkında daha fazla bilgi ver',
          'Розкажи більше про буткемп',
          'Cho mình biết thêm về bootcamp'
        ),
      },
      {
        id: 'homework',
        label: all('Homework', 'Tareas', 'Devoirs', 'Ödevler', 'Домашні завдання', 'Bài tập'),
        ask: all(
          'Tell me about the homework',
          'Cuéntame sobre las tareas',
          'Parle-moi des devoirs',
          'Bana ödevlerden bahset',
          'Розкажи про домашні завдання',
          'Cho mình biết về bài tập'
        ),
      },
      {
        id: 'environment',
        label: all(
          'Environment setup',
          'Configurar entorno',
          "Configurer l'environnement",
          'Ortam kurulumu',
          'Налаштування середовища',
          'Cài đặt môi trường'
        ),
        ask: all(
          'How do I set up my development environment?',
          '¿Cómo configuro mi entorno de desarrollo?',
          'Comment configurer mon environnement de développement ?',
          'Geliştirme ortamımı nasıl kurarım?',
          'Як налаштувати середовище розробки?',
          'Làm sao để cài đặt môi trường phát triển?'
        ),
      },
      {
        id: 'sessions',
        label: all('Sessions', 'Sesiones', 'Sessions', 'Oturumlar', 'Заняття', 'Buổi học'),
        reply: all(
          'Which session?',
          '¿Qué sesión?',
          'Quelle session ?',
          'Hangi oturum?',
          'Яке заняття?',
          'Buổi học nào?'
        ),
        children: [
          {
            id: 'rust',
            label: all('Rust', 'Rust', 'Rust', 'Rust', 'Rust', 'Rust'),
            ask: all(
              'What was covered in the Rust session?',
              '¿Qué se vio en la sesión de Rust?',
              "Qu'a-t-on vu pendant la session Rust ?",
              'Rust oturumunda neler işlendi?',
              'Що розбирали на занятті з Rust?',
              'Buổi học Rust đã nói về những gì?'
            ),
          },
          {
            id: 'solana',
            label: all('Solana', 'Solana', 'Solana', 'Solana', 'Solana', 'Solana'),
            ask: all(
              'What was covered in the Solana session?',
              '¿Qué se vio en la sesión de Solana?',
              "Qu'a-t-on vu pendant la session Solana ?",
              'Solana oturumunda neler işlendi?',
              'Що розбирали на занятті з Solana?',
              'Buổi học Solana đã nói về những gì?'
            ),
          },
          {
            id: 'anchor',
            label: all('Anchor', 'Anchor', 'Anchor', 'Anchor', 'Anchor', 'Anchor'),
            ask: all(
              'What was covered in the Anchor session?',
              '¿Qué se vio en la sesión de Anchor?',
              "Qu'a-t-on vu pendant la session Anchor ?",
              'Anchor oturumunda neler işlendi?',
              'Що розбирали на занятті з Anchor?',
              'Buổi học Anchor đã nói về những gì?'
            ),
          },
        ],
      },
    ],
  },
  {
    id: 'build',
    label: all('Build', 'Construir', 'Construire', 'Geliştir', 'Створювати', 'Xây dựng'),
    reply: all(
      'What do you need help with?',
      '¿Con qué necesitas ayuda?',
      'De quoi as-tu besoin ?',
      'Neye yardım istersin?',
      'З чим тобі потрібна допомога?',
      'Bạn cần giúp gì?'
    ),
    children: [
      {
        id: 'build-environment',
        label: all(
          'Set up your environment',
          'Configura tu entorno',
          'Configure ton environnement',
          'Ortamını kur',
          'Налаштуй своє середовище',
          'Cài đặt môi trường của bạn'
        ),
        ask: all(
          'Set up your environment',
          'Configura tu entorno',
          'Configure ton environnement',
          'Ortamını kur',
          'Налаштуй своє середовище',
          'Cài đặt môi trường của bạn'
        ),
      },
      {
        id: 'build-ideas',
        label: all(
          'I need ideas',
          'Necesito ideas',
          "J'ai besoin d'idées",
          'Fikirlere ihtiyacım var',
          'Мені потрібні ідеї',
          'Mình cần ý tưởng'
        ),
        ask: all(
          'I need ideas',
          'Necesito ideas',
          "J'ai besoin d'idées",
          'Fikirlere ihtiyacım var',
          'Мені потрібні ідеї',
          'Mình cần ý tưởng'
        ),
      },
    ],
  },
  {
    id: 'accelerate',
    label: all('Accelerate', 'Acelerar', 'Accélérer', 'Hızlandır', 'Прискорити', 'Tăng tốc'),
    ask: all(
      'How can I take my project further?',
      '¿Cómo puedo llevar mi proyecto más lejos?',
      'Comment aller plus loin avec mon projet ?',
      'Projemi nasıl daha ileri taşıyabilirim?',
      'Як розвинути мій проєкт далі?',
      'Làm sao để phát triển dự án của mình xa hơn?'
    ),
    disabled: true,
  },
];

export const quickReplyBackLabel = all('Back', 'Atrás', 'Retour', 'Geri', 'Назад', 'Quay lại');

// The voice agent's idle check-in ("Hello?! Are you still there!?"). It is
// written by the LLM, so it is matched loosely; one brings the options back.
export const IDLE_PROMPT =
  /still there|are you there|sigues ah[ií]|est[aá]s ah[ií]|toujours l[àa]|es-tu l[àa]|tu es l[àa]|orada m[ıi]s[ıi]n|hâlâ orada|hala orada|ти тут|ви тут|ще тут|c[oò]n ở đ[aâ]y|bạn c[oò]n đ[oó]/i;

// The root's first option: the newest session recording in the bonfire
// (/api/latest-video), labelled with its title and asked about by name.
export const latestVideoAsk = (title: string) =>
  all(
    `I want to learn more about the "${title}" session recording`,
    `Quiero saber más sobre la grabación de la sesión "${title}"`,
    `J'aimerais en savoir plus sur l'enregistrement de la session "${title}"`,
    `"${title}" oturum kaydı hakkında daha fazla bilgi almak istiyorum`,
    `Я хочу дізнатися більше про запис заняття "${title}"`,
    `Mình muốn tìm hiểu thêm về bản ghi buổi học "${title}"`
  );
