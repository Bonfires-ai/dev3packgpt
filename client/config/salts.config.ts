// Text-only agents hosted on Salts (api.salts.dev), offered next to the LiveKit
// voice agent. Safe for the browser: each agent's API key stays on the server,
// in SALTS_AGENT_KEY_<SLUG> (e.g. SALTS_AGENT_KEY_GENERAL_ASSISTANT).
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
