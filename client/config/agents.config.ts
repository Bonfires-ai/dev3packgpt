import { personaConfig } from '@/config/persona.config';
import { saltsAgents } from '@/config/salts.config';
import { ALL_MOODS, AgentMoodEnum, AgentMoodI } from '@/types/agent';

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
  // Languages this agent is offered in; the language picker shows only these.
  languages: AgentMoodI[];
}

const { english, spanish, french, turkish, ukrainian } = personaConfig.moods;

export const sameForAll = <T>(value: T): ByMood<T> => ({
  [AgentMoodEnum.ENGLISH]: value,
  [AgentMoodEnum.SPANISH]: value,
  [AgentMoodEnum.FRENCH]: value,
  [AgentMoodEnum.TURKISH]: value,
  [AgentMoodEnum.UKRAINIAN]: value,
});

const byMood = <T>(pick: (mood: (typeof personaConfig.moods)[AgentMoodI]) => T): ByMood<T> => ({
  [AgentMoodEnum.ENGLISH]: pick(english),
  [AgentMoodEnum.SPANISH]: pick(spanish),
  [AgentMoodEnum.FRENCH]: pick(french),
  [AgentMoodEnum.TURKISH]: pick(turkish),
  [AgentMoodEnum.UKRAINIAN]: pick(ukrainian),
});

const textAgent = (slug: string): HomeAgent => {
  const agent = saltsAgents.find(a => a.slug === slug);
  if (!agent) throw new Error(`No Salts agent "${slug}" in salts.config.ts`);
  return {
    slug,
    kind: 'text',
    name: agent.name,
    subtitle: sameForAll(agent.subtitle),
    startLabel: byMood(m => m.textStartLabel),
    avatar: agent.avatarImage ? sameForAll(agent.avatarImage) : undefined,
    // Every language; those without a bonfire of their own use the English one.
    languages: ALL_MOODS,
  };
};

export const VOICE_AGENT = 'solene';

// First name, as the voice session's labels and the mic dialog use it.
export const firstName = (agent: HomeAgent) => agent.name.split(' ')[0];

const instructor = (slug: string, name: string, avatar: string, languages: AgentMoodI[]): HomeAgent => {
  const first = name.split(' ')[0];
  return {
    slug,
    kind: 'voice',
    name,
    subtitle: byMood(m => m.instructorSubtitle),
    startLabel: byMood(m => m.instructorStartLabel.replace('{name}', first)),
    avatar: sameForAll(avatar),
    languages,
  };
};

// In carousel order; the page starts on the first voice agent (DEFAULT_AGENT).
export const homeAgents: HomeAgent[] = [
  textAgent('general-assistant'),
  // Voice instructors: one avatar for every language, each offered in exactly one language.
  instructor('deepesh', 'Deepesh Singh', '/avatars/deepesh.gif', [AgentMoodEnum.ENGLISH]),
  instructor('fabian', 'Fabian Sanchez', '/avatars/fabian.gif', [AgentMoodEnum.SPANISH]),
  instructor('ege', 'Ege', '/avatars/ege.gif', [AgentMoodEnum.TURKISH]),
  instructor('fibo', 'Fibo', '/avatars/fibo.gif', [AgentMoodEnum.UKRAINIAN]),
  {
    slug: VOICE_AGENT,
    kind: 'voice',
    name: personaConfig.heroTitle,
    subtitle: byMood(m => m.heroSubtitle),
    startLabel: byMood(m => m.startChatButtonLabel),
    avatar: byMood(m => m.avatarImage),
    languages: [AgentMoodEnum.FRENCH],
  },
];

// The slide the home page opens on: the first LiveKit (voice) agent.
export const DEFAULT_AGENT = homeAgents.find(agent => agent.kind === 'voice')?.slug ?? homeAgents[0].slug;

// What the dev3pack_instructor voice agent becomes for each voice slide: its
// persona (PERSONAS in agent/voice_agent/persona_config.py) and, per language,
// the one MCP server it searches (the agent's MCP_<NAME>_URL secret). Every language
// searches the English bonfire and the agent answers in the session's language.
export interface VoiceSession {
  persona: string;
  mcpServer: ByMood<string>;
}

const BONFIRES_MCP: ByMood<string> = {
  [AgentMoodEnum.ENGLISH]: 'dev3pack',
  [AgentMoodEnum.SPANISH]: 'dev3pack',
  [AgentMoodEnum.FRENCH]: 'dev3pack',
  [AgentMoodEnum.TURKISH]: 'dev3pack',
  [AgentMoodEnum.UKRAINIAN]: 'dev3pack',
};

export const voiceSessions: Record<string, VoiceSession> = {
  [VOICE_AGENT]: { persona: 'solene', mcpServer: BONFIRES_MCP },
  fabian: { persona: 'fabian', mcpServer: BONFIRES_MCP },
  deepesh: { persona: 'deepesh', mcpServer: BONFIRES_MCP },
  ege: { persona: 'ege', mcpServer: BONFIRES_MCP },
  fibo: { persona: 'fibo', mcpServer: BONFIRES_MCP },
};

// The start button on phones: one word by kind, in place of startLabel.
export const shortStartLabel: Record<HomeAgent['kind'], ByMood<string>> = {
  voice: byMood(m => m.voiceShortLabel),
  text: byMood(m => m.textShortLabel),
};

export const findHomeAgent = (slug: string) => homeAgents.find(agent => agent.slug === slug);

// The home page picks a language first, then shows only the agents offered in it.
export const agentsFor = <T extends HomeAgent>(agents: T[], mood: AgentMoodI) =>
  agents.filter(agent => agent.languages.includes(mood));
