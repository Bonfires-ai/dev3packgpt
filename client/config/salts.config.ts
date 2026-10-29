// Text-only agents hosted on Salts (api.salts.dev), offered next to the LiveKit
// voice agent. Safe for the browser. Each entry is a chat with the signed-in
// member's own agent in the Salts fleet (lib/salts.ts), not a shared agent.
export interface SaltsAgent {
  slug: string;
  name: string;
  // Under the title on the home page.
  subtitle: string;
  // Home page avatar; without one the carousel shows a placeholder with the initials.
  avatarImage?: string;
  // Shown the moment the session starts; Salts agents do not greet on their own.
  greeting: string;
}

export const saltsAgents: SaltsAgent[] = [
  {
    slug: 'general-assistant',
    name: 'Bonfires Agent',
    subtitle: 'Personal teaching assistant',
    greeting: "Hi! I'm the Bonfires Agent. What can I help you with?",
  },
];

export const findSaltsAgent = (slug: string | null | undefined) => saltsAgents.find(agent => agent.slug === slug);
