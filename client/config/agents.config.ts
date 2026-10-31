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

// First name, as the voice session's labels and the mic dialog use it.
export const firstName = (agent: HomeAgent) => agent.name.split(' ')[0];

const instructor = (slug: string, name: string, avatar: string): HomeAgent => {
  const first = name.split(' ')[0];
  return {
    slug,
    kind: 'voice',
    name,
    subtitle: { english: 'Dev3pack Instructor', spanish: 'Instructor de Dev3pack' },
    startLabel: { english: `Talk with ${first}`, spanish: `Habla con ${first}` },
    avatar: sameForBoth(avatar),
  };
};

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
  // The other instructors: one avatar for both languages for now.
  instructor('fabian', 'Fabian Sanchez', '/avatars/fabian.gif'),
  instructor('deepesh', 'Deepesh Singh', '/avatars/deepesh.jpg'),
  instructor('santiago', 'Santiago Villareal', '/avatars/santiago.jpg'),
];

// What the dev3pack_instructor voice agent becomes for each voice slide: its
// persona (PERSONAS in agent/voice_agent/persona_config.py) and, per language,
// the one MCP server it searches (the agent's MCP_<NAME>_URL secret).
export interface VoiceSession {
  persona: string;
  mcpServer: ByMood<string>;
}

const BONFIRES_MCP: ByMood<string> = { [AgentMoodEnum.ENGLISH]: 'dev3pack', [AgentMoodEnum.SPANISH]: 'dev3pack_es' };

export const voiceSessions: Record<string, VoiceSession> = {
  [VOICE_AGENT]: { persona: 'solene', mcpServer: BONFIRES_MCP },
  fabian: { persona: 'fabian', mcpServer: BONFIRES_MCP },
  deepesh: { persona: 'deepesh', mcpServer: BONFIRES_MCP },
  santiago: { persona: 'santiago', mcpServer: BONFIRES_MCP },
};

// The start button on phones: one word by kind, in place of startLabel.
export const shortStartLabel: Record<HomeAgent['kind'], ByMood<string>> = {
  voice: { [AgentMoodEnum.ENGLISH]: 'Talk', [AgentMoodEnum.SPANISH]: 'Hablar' },
  text: { [AgentMoodEnum.ENGLISH]: 'Chat', [AgentMoodEnum.SPANISH]: 'Chatear' },
};

export const findHomeAgent = (slug: string) => homeAgents.find(agent => agent.slug === slug);
