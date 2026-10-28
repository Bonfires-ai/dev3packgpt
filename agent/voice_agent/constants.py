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
