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
  heroDescription:
    'Ask Solène your questions about Web3, AI and Dev3pack, by voice or text. Pick English or Français and go.',
  heroAvatarAlt: 'Solène Avatar',

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
      heroSubtitle: 'Dev3pack Instructor',
      startChatButtonLabel: 'Talk with Solène',
      accentClass: 'bg-synthesis text-white',
      visualizerBgColor: '#A15EED',
      // Shown without voice the moment the room connects. Keep in sync with
      // mood_greeting in agent/voice_agent/constants.py.
      greeting: "Hey, welcome! I'm here to help with your questions. What would you like to understand better?",
      endCard: {
        title: 'Session complete',
        motif: 'Thanks for learning with me',
        shareLabel: 'Share on X',
        shareText:
          'Just wrapped a study session with Solène, my teaching assistant for the Dev3pack AI-Engineering Bootcamp. #Dev3pack',
        body: 'Keep the momentum going: explore more about the topics we talked about, and feel free to come back anytime if you have more questions.',
        linkLabel: 'Explore Dev3pack',
        saveLabel: 'Save session',
        againLabel: 'Ask more questions',
      },
      inputPlaceholder: "Say 'Bye' to finish this session",
      sendLabel: 'Send',
      muteLabel: 'Mute Solène',
      unmuteLabel: 'Unmute Solène',
      micMuteLabel: 'Mute your microphone',
      micUnmuteLabel: 'Unmute your microphone',
      endCallLabel: 'End call',
      startingLabel: 'Starting…',
      mic: {
        title: 'Turn on your microphone',
        body: 'So Solène can hear you.',
        allow: 'Allow',
        waiting: 'Waiting…',
        cancel: 'Not now',
        retry: 'Try again',
        blocked: 'Your microphone is blocked. Allow it from the icon in the address bar, then try again.',
        missing: 'No microphone found. Connect one and try again.',
      },
    },
    french: {
      label: 'Français',
      subtitle: 'Discutez avec Solène en français.',
      description: 'Solène, fondatrice de Dev3pack, prête à répondre à tes questions — en français.',
      avatarImage: '/avatars/solene-fr.gif',
      heroSubtitle: 'Instructrice Dev3pack',
      startChatButtonLabel: 'Parler à Solène',
      accentClass: 'bg-synthesis-dark text-white',
      visualizerBgColor: '#7C3AED',
      greeting: "Bienvenue ! Je suis là pour répondre à tes questions. Qu'est-ce que tu aimerais mieux comprendre ?",
      endCard: {
        title: 'Session terminée',
        motif: "Merci d'avoir appris avec moi",
        shareLabel: 'Partager sur X',
        shareText:
          "Je viens de finir une session d'étude avec Solène, mon assistante pédagogique pour le Dev3pack AI-Engineering Bootcamp. #Dev3pack",
        body: "Garde l'élan : approfondis les sujets dont on a parlé, et n'hésite pas à revenir quand tu veux si tu as d'autres questions.",
        linkLabel: 'Découvrir Dev3pack',
        saveLabel: 'Enregistrer la session',
        againLabel: "Poser d'autres questions",
      },
      inputPlaceholder: 'Dis « Au revoir » pour terminer la session',
      sendLabel: 'Envoyer',
      muteLabel: 'Couper le son de Solène',
      unmuteLabel: 'Réactiver le son de Solène',
      micMuteLabel: 'Couper ton micro',
      micUnmuteLabel: 'Réactiver ton micro',
      endCallLabel: "Terminer l'appel",
      startingLabel: 'Démarrage…',
      mic: {
        title: 'Active ton micro',
        body: "Pour que Solène puisse t'entendre.",
        allow: 'Autoriser',
        waiting: 'En attente…',
        cancel: 'Plus tard',
        retry: 'Réessayer',
        blocked: "Ton micro est bloqué. Autorise-le depuis l'icône dans la barre d'adresse, puis réessaie.",
        missing: 'Aucun micro trouvé. Branches-en un et réessaie.',
      },
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
