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
  // Shown the moment the session starts; Salts agents do not greet on their own.
  greeting: string;
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
    greeting: "Hi! I'm the Bonfires Agent. What can I help you with?",
    mcpServer: { english: 'Dev3Pack', spanish: 'Dev3Pack Spanish' },
  },
];

export const findSaltsAgent = (slug: string | null | undefined) => saltsAgents.find(agent => agent.slug === slug);
