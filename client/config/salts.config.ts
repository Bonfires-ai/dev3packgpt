// Text-only agents hosted on Salts (api.salts.dev), offered next to the LiveKit
// voice agent. Safe for the browser. Each entry is a chat with the signed-in
// member's own agent in the Salts fleet (lib/salts.ts), not a shared agent.
import type { AgentMoodI } from '@/types/agent';

export interface SaltsAgent {
  slug: string;
  name: string;
  // Under the title on the home page.
  subtitle: string;
  // Home page avatar; without one the carousel shows a placeholder with the initials.
  avatarImage?: string;
  // Shown the moment the session starts, in the selected language; Salts agents do not greet on their own.
  greeting: Record<AgentMoodI, string>;
  // The one MCP server (by its name on the Salts agent) each language may use; the
  // other is never offered, the same split the voice agent's MCP has.
  mcpServer: Record<AgentMoodI, string>;
}

export const saltsAgents: SaltsAgent[] = [
  {
    slug: 'general-assistant',
    name: 'Bonfires Agent',
    subtitle: 'Personal teaching assistant',
    // Signed out only: signed in, the slide shows the member's own photo or initials.
    avatarImage: '/avatars/bonfires.svg',
    greeting: {
      english: "Hi! I'm the Bonfires Agent. What can I help you with?",
      spanish: '¡Hola! Soy el Bonfires Agent. ¿En qué puedo ayudarte?',
      french: "Salut ! Je suis le Bonfires Agent. Comment puis-je t'aider ?",
      turkish: 'Merhaba! Ben Bonfires Agent. Sana nasıl yardımcı olabilirim?',
      ukrainian: 'Привіт! Я Bonfires Agent. Чим можу допомогти?',
      vietnamese: 'Xin chào! Mình là Bonfires Agent. Mình có thể giúp gì cho bạn?',
    },
    // French, Turkish, Ukrainian and Vietnamese have no bonfire of their own and use the English server.
    mcpServer: {
      english: 'Dev3Pack',
      spanish: 'Dev3Pack Spanish',
      french: 'Dev3Pack',
      turkish: 'Dev3Pack',
      ukrainian: 'Dev3Pack',
      vietnamese: 'Dev3Pack',
    },
  },
];

export const findSaltsAgent = (slug: string | null | undefined) => saltsAgents.find(agent => agent.slug === slug);
