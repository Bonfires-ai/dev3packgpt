export const personaConfig = {
  // App identity
  appName: 'Solène',
  tagline: 'Dev3pack Instructor',
  description: 'Ask Solène Daviaud, founder of Dev3pack, your questions about Web3 and AI.',
  siteUrl: 'https://dev3pack.xyz',
  blogUrl: 'https://dev3pack.xyz',

  // OG / SEO
  ogImagePath: '/og-image-1.1.png',
  favicon: {
    svg: '/favicon_io/favicon.svg',
    ico: '/favicon_io/favicon.ico',
    apple: '/favicon_io/apple-touch-icon.png',
  },

  // Landing page
  heroTitle: 'Solène',
  heroSubtitle: 'Dev3pack Instructor',
  heroDescription: 'Ask Solène your questions about Web3, AI and Dev3pack, by voice or text. Pick English or Français and go.',
  heroAvatarImage: '/avatars/solene-en.gif',
  heroAvatarAlt: 'Solène Avatar',
  startChatButtonLabel: 'TALK WITH SOLÈNE',

  // Footer
  footer: {
    credit: 'Dev3pack',
    creditUrl: 'https://dev3pack.xyz',
    socialLinks: [
      { label: 'Dev3pack', url: 'https://dev3pack.xyz' },
      { label: 'LinkedIn', url: 'https://fr.linkedin.com/in/solene-daviaud/en' },
    ],
    githubRepo: 'https://github.com/Bonfires-ai/solenegpt',
  },

  // Moods / personas — repurposed as language selectors (same warm Solène persona)
  moods: {
    english: {
      label: 'English',
      subtitle: 'Chat with Solène in English.',
      description: 'Solène, founder of Dev3pack, ready to answer your questions — in English.',
      avatarImage: '/avatars/solene-en.gif',
      accentClass: 'bg-synthesis text-white',
      visualizerVariant: 'synthesis' as const,
      visualizerBgColor: '#A15EED',
      connectingLabel: 'Solène (English)',
      endCard: {
        title: 'Session complete',
        body: 'Thanks for learning with me today. Keep the momentum going: try one thing we talked about, and join a Dev3pack bootcamp or hackathon hub to keep learning with the community.',
        linkLabel: 'Explore Dev3pack',
        saveLabel: 'Save session',
        againLabel: 'Ask more questions',
      },
      inputPlaceholder: 'Type a question…',
      sendLabel: 'Send',
      muteLabel: 'Mute Solène',
      unmuteLabel: 'Unmute Solène',
      endHint: "Say 'Bye' or press 'End' to finish this session",
    },
    french: {
      label: 'Français',
      subtitle: 'Discutez avec Solène en français.',
      description: 'Solène, fondatrice de Dev3pack, prête à répondre à tes questions — en français.',
      avatarImage: '/avatars/solene-fr.gif',
      accentClass: 'bg-synthesis-dark text-white',
      visualizerVariant: 'synthesis' as const,
      visualizerBgColor: '#7C3AED',
      connectingLabel: 'Solène (Français)',
      endCard: {
        title: 'Session terminée',
        body: "Merci d'avoir appris avec moi aujourd'hui. Garde l'élan : essaie une chose dont on a parlé, et rejoins un bootcamp ou un hub hackathon Dev3pack pour continuer à apprendre avec la communauté.",
        linkLabel: 'Découvrir Dev3pack',
        saveLabel: 'Enregistrer la session',
        againLabel: "Poser d'autres questions",
      },
      inputPlaceholder: 'Écris ta question…',
      sendLabel: 'Envoyer',
      muteLabel: 'Couper le son de Solène',
      unmuteLabel: 'Réactiver le son de Solène',
      endHint: "Dis « Au revoir » ou appuie sur « End » pour terminer la session",
    },
  },

  // Wallet metadata (only used if Zora minting / wallet flows are enabled)
  walletMetadata: {
    name: 'Solène (Dev3pack)',
    description: 'Talk to Solène Daviaud, founder of Dev3pack',
    url: 'https://dev3pack.xyz',
    icons: ['https://avatars.githubusercontent.com/u/2653167'],
  },
};

export type PersonaConfig = typeof personaConfig;
export type MoodKey = keyof typeof personaConfig.moods;

export const isZoraMintingEnabled = process.env.NEXT_PUBLIC_ENABLE_ZORA_MINTING !== 'false';
