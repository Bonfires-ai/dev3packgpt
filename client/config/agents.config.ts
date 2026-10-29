import { personaConfig } from '@/config/persona.config';
import { saltsAgents } from '@/config/salts.config';
import { AgentMoodEnum, AgentMoodI } from '@/types/agent';

type ByMood<T> = Record<AgentMoodI, T>;

// One slide in the home page carousel. Voice agents start the LiveKit session;
// text agents start a Salts chat (see salts.config.ts). The language picker
// switches every agent to its version for that language.
export interface HomeAgent {
  slug: string;
  kind: 'voice' | 'text';
  name: string;
  subtitle: ByMood<string>;
  startLabel: ByMood<string>;
  // Without one the carousel shows a placeholder with the initials.
  avatar?: ByMood<string>;
  // Placeholder letters; defaults to the name's initials.
  initials?: string;
}

const { english, spanish } = personaConfig.moods;

const sameForBoth = <T>(value: T): ByMood<T> => ({ [AgentMoodEnum.ENGLISH]: value, [AgentMoodEnum.SPANISH]: value });

const textAgent = (slug: string): HomeAgent => {
  const agent = saltsAgents.find(a => a.slug === slug);
  if (!agent) throw new Error(`No Salts agent "${slug}" in salts.config.ts`);
  return {
    slug,
    kind: 'text',
    name: agent.name,
    // The Spanish version is the same agent for now.
    subtitle: sameForBoth(agent.subtitle),
    startLabel: { english: english.textStartLabel, spanish: spanish.textStartLabel },
    avatar: agent.avatarImage ? sameForBoth(agent.avatarImage) : undefined,
  };
};

export const VOICE_AGENT = 'solene';

// In carousel order; the page starts on Solène.
export const homeAgents: HomeAgent[] = [
  textAgent('general-assistant'),
  {
    slug: VOICE_AGENT,
    kind: 'voice',
    name: personaConfig.heroTitle,
    subtitle: { english: english.heroSubtitle, spanish: spanish.heroSubtitle },
    startLabel: { english: english.startChatButtonLabel, spanish: spanish.startChatButtonLabel },
    avatar: { english: english.avatarImage, spanish: spanish.avatarImage },
  },
  {
    // Placeholder until Fabian has his own voice agent: it starts the same
    // LiveKit session. One avatar for both languages for now.
    slug: 'fabian',
    kind: 'voice',
    name: 'Fabian Sanchez',
    subtitle: { english: 'Dev3pack Instructor', spanish: 'Instructor de Dev3pack' },
    startLabel: { english: 'Talk with Fabian', spanish: 'Habla con Fabian' },
    avatar: sameForBoth('/avatars/fabian.gif'),
  },
];

export const findHomeAgent = (slug: string) => homeAgents.find(agent => agent.slug === slug);
