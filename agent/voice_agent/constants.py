from voice_agent.prompts.prompts import (
    build_mood_prompt,
    english_initial_prompt,
    french_initial_prompt,
    english_greetings,
    french_greetings,
)
from voice_agent.persona_config import (
    TIMEOUT_SECONDS,
    TIMEOUT_WARNING_TIME,
    SPEAK_DELAY,
    DEFAULT_VOICE_ID as ELEVENLABS_DEFAULT_VOICE_ID,
)

mood_initial_prompts = {
    "english": english_initial_prompt,
    "french": french_initial_prompt,
}

mood_initial_greetings = {"english": english_greetings, "french": french_greetings}

# Fixed, text-only opening and closing lines (never spoken). The client shows
# the greeting itself the moment the room connects, so keep the greetings in
# sync with `greeting` in client/config/persona.config.ts.
mood_greeting = {
    "english": "Hey, welcome! I'm here to help with your questions. What would you like to understand better?",
    "french": "Bienvenue ! Je suis là pour répondre à tes questions. Qu'est-ce que tu aimerais mieux comprendre ?",
}

mood_goodbye = {
    "english": "Goodbye for now, and take care. I'll be here when you want to keep learning.",
    "french": "Au revoir pour l'instant, et prends soin de toi. Je serai là quand tu voudras continuer à apprendre.",
}
