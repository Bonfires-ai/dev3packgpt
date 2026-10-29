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
    'Ask Solène your questions about Web3, AI and Dev3pack, by voice or text. Pick English or Español and go.',
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
        transcriptTitle: 'Session with Solène',
        transcriptYou: 'You',
        transcriptDate: 'Date',
        transcriptLanguage: 'Language',
      },
      inputPlaceholder: "Say 'Bye' to finish this session",
      sendLabel: 'Send',
      muteLabel: 'Mute Solène',
      unmuteLabel: 'Unmute Solène',
      micMuteLabel: 'Mute your microphone',
      micUnmuteLabel: 'Unmute your microphone',
      endCallLabel: 'End call',
      // Text-only Salts agents; {name} is the agent's name where it appears.
      textStartLabel: 'Start chatting',
      textPlaceholder: 'Message {name}',
      endChatLabel: 'End chat',
      voiceOptionLabel: 'Voice',
      textOptionLabel: 'Text',
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
      signIn: {
        title: 'Verify your account',
        body: 'Sign in with the email that is approved by Dev3Pack for this cohort.',
        signIn: 'Sign in',
        redirecting: 'Redirecting…',
        cancel: 'Not now',
      },
    },
    spanish: {
      label: 'Español',
      subtitle: 'Habla con Solène en español.',
      description: 'Solène, fundadora de Dev3pack, lista para responder tus preguntas, en español.',
      avatarImage: '/avatars/solene-es.gif',
      heroSubtitle: 'Instructora de Dev3pack',
      startChatButtonLabel: 'Habla con Solène',
      accentClass: 'bg-synthesis-dark text-white',
      visualizerBgColor: '#7C3AED',
      // Keep in sync with mood_greeting in agent/voice_agent/constants.py.
      greeting: '¡Bienvenido! Estoy aquí para responder tus preguntas. ¿Qué te gustaría entender mejor?',
      endCard: {
        title: 'Sesión completada',
        motif: 'Gracias por aprender conmigo',
        shareLabel: 'Compartir en X',
        shareText:
          'Acabo de terminar una sesión de estudio con Solène, mi asistente de enseñanza del Dev3pack AI-Engineering Bootcamp. #Dev3pack',
        body: 'Mantén el impulso: profundiza en los temas de los que hablamos y vuelve cuando quieras si tienes más preguntas.',
        linkLabel: 'Descubre Dev3pack',
        saveLabel: 'Guardar sesión',
        againLabel: 'Hacer más preguntas',
        transcriptTitle: 'Sesión con Solène',
        transcriptYou: 'Tú',
        transcriptDate: 'Fecha',
        transcriptLanguage: 'Idioma',
      },
      inputPlaceholder: "Di 'Adiós' para terminar la sesión",
      sendLabel: 'Enviar',
      muteLabel: 'Silenciar a Solène',
      unmuteLabel: 'Activar el sonido de Solène',
      micMuteLabel: 'Silenciar tu micrófono',
      micUnmuteLabel: 'Activar tu micrófono',
      endCallLabel: 'Terminar llamada',
      textStartLabel: 'Empezar a chatear',
      textPlaceholder: 'Escribe a {name}',
      endChatLabel: 'Terminar el chat',
      voiceOptionLabel: 'Voz',
      textOptionLabel: 'Texto',
      startingLabel: 'Iniciando…',
      mic: {
        title: 'Activa tu micrófono',
        body: 'Para que Solène pueda escucharte.',
        allow: 'Permitir',
        waiting: 'Esperando…',
        cancel: 'Ahora no',
        retry: 'Reintentar',
        blocked:
          'Tu micrófono está bloqueado. Permítelo desde el icono de la barra de direcciones y vuelve a intentarlo.',
        missing: 'No se encontró ningún micrófono. Conecta uno y vuelve a intentarlo.',
      },
      signIn: {
        title: 'Verifica tu cuenta',
        body: 'Inicia sesión con el correo aprobado por Dev3Pack para esta cohorte.',
        signIn: 'Iniciar sesión',
        redirecting: 'Redirigiendo…',
        cancel: 'Ahora no',
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
