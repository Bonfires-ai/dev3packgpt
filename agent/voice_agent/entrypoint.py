from __future__ import annotations

import asyncio
import os
import random
import time
from asyncio import Task
from typing import Optional
from dataclasses import dataclass

from livekit.agents import (
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, elevenlabs, openai
from livekit.plugins.elevenlabs import VoiceSettings
from livekit.plugins.turn_detector.english import EnglishModel
import requests
from voice_agent import openrouter_tts
from voice_agent.persona_config import (
    VOICE_SPEED,
    VOICE_STABILITY,
    VOICE_SIMILARITY_BOOST,
    VOICE_STYLE,
    VOICE_USE_SPEAKER_BOOST,
    DEEPGRAM_LANGUAGE_BY_MOOD,
    VOICE_ID_BY_MOOD,
)
from voice_agent.stt_words import stt_words
from voice_agent.assistant import Assistant, prewarm
from voice_agent import bonfires
from voice_agent.constants import (
    build_mood_prompt,
    CALL_DURATION_WARNING_TIME,
    ELEVENLABS_DEFAULT_VOICE_ID,
    MAX_CALL_DURATION,
    TIMEOUT_WARNING_TIME,
    SPEAK_DELAY,
    TIMEOUT_SECONDS,
    mood_initial_greetings,
)
from voice_agent.logger import get_logger

logger = get_logger()

_active_tasks = set()


@dataclass
class SessionInfo:
    room_id: str | None = None
    mood: str | None = None
    monitor_task: Task[None] | None = None


async def async_handle_user_end_conversation(
    reader, participant_identity, ctx: JobContext, session: AgentSession
):
    try:
        await session.interrupt()
    except Exception:
        await session.current_speech.wait_for_playout()

    session.input.set_audio_enabled(False)
    session.clear_user_turn()

    await reader.read_all()

    await session.generate_reply(
        user_input="Goodbye for now. Please end the conversation",
        allow_interruptions=False,
    )


def handle_user_end_conversation(
    reader, participant_identity, ctx: JobContext, session: AgentSession
):
    task = asyncio.create_task(
        async_handle_user_end_conversation(reader, participant_identity, ctx, session)
    )
    _active_tasks.add(task)
    task.add_done_callback(lambda t: _active_tasks.remove(t))


async def entrypoint(ctx: JobContext):  # noqa: C901 – keep high complexity for now
    """Entrypoint for LiveKit worker processes.

    This function closely mirrors the original implementation in *main.py* but is
    organised for readability. The LiveKit lifecycle (connect → create session →
    event-loop) remains unchanged so behaviour stays identical.
    """

    # ---------------------------------------------------------------------
    # Connect to the room and derive mood from room name prefix
    # ---------------------------------------------------------------------
    logger.info("Connecting to room %s", ctx.room.name)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # When the human leaves (closes tab, drops connection, etc.) tear down
    # immediately instead of waiting for the idle-timeout / "are you still
    # there?" prompt to fire into the void. Saves ~40s of useless TTS/LLM
    # calls per abandoned session and frees the worker subprocess sooner.
    def _on_participant_disconnected(participant):
        logger.info("Participant %s disconnected — shutting down", participant.identity)
        ctx.shutdown(reason="participant_disconnected")

    ctx.room.on("participant_disconnected", _on_participant_disconnected)

    try:
        mood = ctx.room.name.split("_")[0]
    except ValueError:
        logger.warning("Room name does not contain a mood prefix – using default mood")
        mood = "english"  # sensible default
    logger.debug("Conversation mood resolved to '%s'", mood)

    # Parse room ID from room name (format: <mood>_room_<roomId>)
    parts = ctx.room.name.split("_")
    if len(parts) >= 3:
        room_id = parts[2]
    else:
        import uuid

        room_id = str(uuid.uuid4())
        logger.warning(
            "Room name '%s' does not contain a room ID – generated fallback: %s",
            ctx.room.name,
            room_id,
        )

    # Optional: save initial conversation to analytics backend (legacy Devfolio path; forks can ignore)
    datalayer_base_url = os.environ.get("DATALAYER_BASE_URL")
    datalayer_api_key = os.environ.get("DATALAYER_API_KEY")
    datalayer_path = os.environ.get(
        "DATALAYER_PATH", "miscellaneous/austingpt/conversations"
    )

    if datalayer_base_url and datalayer_api_key:
        try:
            response = requests.post(
                f"{datalayer_base_url}{datalayer_path}",
                json={
                    "roomId": room_id,
                },
                headers={"x_api_key": datalayer_api_key},
            )
            response.raise_for_status()
            logger.info("Successfully saved conversation to database")
        except Exception as e:
            logger.error(f"Failed to save initial conversation: {e}")
    else:
        logger.info(
            "Skipping analytics datalayer call - required environment variables not defined"
        )

    greetings = mood_initial_greetings[mood]

    # ------------------------------------------------------------------
    # Prime the agent with knowledge context — static markdown files plus
    # the live Bonfires knowledge graph if configured.
    # ------------------------------------------------------------------
    from voice_agent import knowledge

    static_ctx = knowledge.load_static_knowledge() if knowledge.is_enabled() else ""
    bonfires_ctx = await bonfires.prime_context(mood)

    parts = [p for p in (static_ctx, bonfires_ctx) if p]
    primed_context = "\n\n---\n\n".join(parts)

    if primed_context:
        logger.info(
            "Primed context: %d chars (%d static + %d bonfires)",
            len(primed_context),
            len(static_ctx),
            len(bonfires_ctx),
        )
    else:
        logger.info("No primed context — agent will rely on persona alone")

    system_prompt = build_mood_prompt(mood, primed_context=primed_context)

    # ------------------------------------------------------------------
    # Create the Agent session with STT/LLM/TTS building blocks
    # ------------------------------------------------------------------
    deepgram_language = DEEPGRAM_LANGUAGE_BY_MOOD.get(mood, "en-US")
    voice_id = VOICE_ID_BY_MOOD.get(mood) or os.environ.get("ELEVEN_VOICE_ID", ELEVENLABS_DEFAULT_VOICE_ID)
    logger.info("STT language=%s, voice_id=%s (mood=%s)", deepgram_language, voice_id, mood)

    # Deepgram nova-3 `keyterms` are English-only. Skip them for other languages
    # (the base model still handles loanwords like "DeFi", "smart contract" fine).
    # `smart_format=True` formats digits as digits ("402" instead of "four zero two"),
    # respects punctuation, capitalizes proper nouns. Critical for crypto jargon
    # like "ERC20", "EIP-712".
    # NOTE: livekit-plugins-deepgram does not expose Deepgram's `replace` URL param,
    # so we can't patch "x four zero two" → "x402" at the STT layer. Instead the
    # client's TranscriptionView sanitizer fixes the displayed transcript. The LLM
    # still receives the spelled-out form, but it's smart enough to interpret it.
    stt_kwargs: dict = {
        "model": "nova-3",
        "language": deepgram_language,
        "smart_format": True,
    }
    if deepgram_language.startswith("en"):
        stt_kwargs["keyterms"] = stt_words

    # ElevenLabs carries the cloned Solène voices. Without an ElevenLabs key,
    # fall back to OpenRouter TTS (stock voice) on the same key as the LLM.
    if os.environ.get("ELEVEN_API_KEY"):
        session_tts = elevenlabs.TTS(
            model="eleven_flash_v2_5",
            voice_id=voice_id,
            voice_settings=VoiceSettings(
                speed=VOICE_SPEED,
                stability=VOICE_STABILITY,
                similarity_boost=VOICE_SIMILARITY_BOOST,
                style=VOICE_STYLE,
                use_speaker_boost=VOICE_USE_SPEAKER_BOOST,
            ),
        )
    else:
        logger.warning("ELEVEN_API_KEY not set — falling back to OpenRouter TTS")
        session_tts = openrouter_tts.TTS(
            api_key=os.environ["OPENROUTER_API_KEY"],
            model=os.environ.get("OPENROUTER_TTS_MODEL", openrouter_tts.DEFAULT_MODEL),
            voice=os.environ.get("OPENROUTER_TTS_VOICE", openrouter_tts.DEFAULT_VOICE),
        )

    session = AgentSession(
        stt=deepgram.STT(**stt_kwargs),
        llm=openai.LLM(
            model=os.environ.get("LLM_MODEL", "openai/gpt-5.4-mini"),
            base_url=os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1"),
            api_key=os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY"),
        ),
        tts=session_tts,
        vad=ctx.proc.userdata["vad"],
        turn_detection=EnglishModel(),
        userdata=SessionInfo(),
    )

    session.userdata.room_id = room_id
    session.userdata.mood = mood

    # Agent that will power the conversation
    agent = Assistant(system_prompt)

    # ------------------------------------------------------------------
    # Local state tracking – kept as simple primitives to avoid overhead
    # ------------------------------------------------------------------
    last_interaction_time: Optional[float] = time.time()
    still_there_prompt_sent = False
    is_agent_speaking = False
    is_user_speaking = False
    call_start_time = time.time()
    duration_warning_sent = False

    # Convenience -----------------------------------------------------------------

    def reset_timeout() -> None:
        nonlocal still_there_prompt_sent, last_interaction_time
        still_there_prompt_sent = False
        last_interaction_time = time.time()

    # ------------------------------------------------------------------
    # Helper coroutines --------------------------------------------------
    # ------------------------------------------------------------------

    async def should_end_call() -> bool:
        """Return ``True`` when the idle-timeout is passed."""
        nonlocal still_there_prompt_sent
        idle_time = int(time.time() - (last_interaction_time or time.time()))

        if idle_time >= TIMEOUT_WARNING_TIME:
            logger.debug(
                "Idle time: %d (Prompt sent: %s, Agent speaking: %s, User speaking: %s)",
                idle_time,
                still_there_prompt_sent,
                is_agent_speaking,
                is_user_speaking,
            )
        if is_agent_speaking or is_user_speaking:
            return False
        return idle_time > TIMEOUT_SECONDS

    async def send_idle_prompt() -> None:
        nonlocal still_there_prompt_sent
        if is_agent_speaking or is_user_speaking:
            return

        if (
            time.time() - (last_interaction_time or time.time()) >= TIMEOUT_WARNING_TIME
            and not still_there_prompt_sent
        ):
            logger.info("Sending idle prompt to user")
            still_there_prompt_sent = True
            await session.generate_reply(
                instructions=(
                    "The user has been inactive. Say something like 'Hello?! Are you still there!?' to get their attention and ask if they want to continue."
                ),
                allow_interruptions=True,
            )

    async def monitor_interaction() -> None:
        nonlocal duration_warning_sent
        while True:
            logger.info(
                "is_agent_speaking=%s | is_user_speaking=%s | still_there_prompt_sent=%s",
                is_agent_speaking,
                is_user_speaking,
                still_there_prompt_sent,
            )

            # Reset idle timer when either party is talking
            if (is_agent_speaking or is_user_speaking) and not still_there_prompt_sent:
                reset_timeout()

            # ---- Call duration monitoring ----------------------------------
            elapsed = int(time.time() - call_start_time)

            if elapsed >= CALL_DURATION_WARNING_TIME and not duration_warning_sent:
                logger.info("Sending call duration warning")

                session.input.set_audio_enabled(False)
                session.clear_user_turn()

                speech_handle = session.say(
                    "I gotta run quick, but I'd love to hear more about what you're building! Please wrap up any important points you'd like to discuss soon!",
                    allow_interruptions=False,
                )
                if session.current_speech is not None:
                    await session.current_speech.wait_for_playout()

                await speech_handle.wait_for_playout()

                duration_warning_sent = True

                session.input.set_audio_enabled(True)

            if elapsed >= MAX_CALL_DURATION:
                logger.info("Max call duration reached – wrapping up")

                # Stop listening to the user while we send the goodbye message
                session.input.set_audio_enabled(False)
                session.clear_user_turn()

                speech_handle = session.say(
                    "Aha! This was fun, but I'm afraid that's all that we have for today. I can't wait to see your idea come to life!",
                    allow_interruptions=False,
                )
                if session.current_speech is not None:
                    await session.current_speech.wait_for_playout()

                await speech_handle.wait_for_playout()

                await session.generate_reply(
                    instructions=(
                        "The conversation has concluded. Please call the `end_conversation` function to end the call..."
                    ),
                    allow_interruptions=False,
                )

                await asyncio.sleep(SPEAK_DELAY)
                break

            # ---- Idle timeout ---------------------------------------------
            if await should_end_call():
                logger.info("Ending call due to inactivity")

                end_handle = session.generate_reply(
                    instructions=(
                        "The user has remained inactive even after reminding them. They seem to be busy at the moment. Just Inform them you are now have to hang up the call for now. There is nothing inappropriate about this, Please dont bring that up. Just let the user know that you're hanging up..."
                    ),
                    allow_interruptions=False,
                )

                logger.debug("Playing out the end handle")

                await end_handle.wait_for_playout()

                logger.debug(
                    "end handle played out... Calling the end conversation function"
                )

                await session.generate_reply(
                    instructions=(
                        "The conversation has concluded. Please call the `end_conversation` function to end the call... YOU MUST CALL THE `end_conversation` FUNCTION IMMEDIATELY"
                    ),
                    allow_interruptions=False,
                )

                # await asyncio.sleep(SPEAK_DELAY)
                break

            await send_idle_prompt()
            await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # Register event handlers -------------------------------------------
    # ------------------------------------------------------------------

    @session.on("agent_state_changed")
    def _on_agent_state_changed(ev):
        nonlocal is_agent_speaking
        logger.info("Agent state changed from %s to %s", ev.old_state, ev.new_state)
        is_agent_speaking = ev.new_state == "speaking"
        if not is_agent_speaking:
            logger.info("Agent stopped speaking")

    @session.on("user_state_changed")
    def _on_user_state_changed(ev):
        nonlocal is_user_speaking
        logger.info("User state changed from %s to %s", ev.old_state, ev.new_state)
        is_user_speaking = ev.new_state == "speaking"
        reset_timeout()

    # ------------------------------------------------------------------
    # Register Text Stream Handlers ------------------------------------
    # ------------------------------------------------------------------

    ctx.room.register_text_stream_handler(
        "user_end_conversation",
        lambda reader, participant_identity: handle_user_end_conversation(
            reader, participant_identity, ctx, session
        ),
    )

    # ------------------------------------------------------------------
    # Kick off the conversation -----------------------------------------
    # ------------------------------------------------------------------

    await session.start(room=ctx.room, agent=agent)

    greeting = random.choice(greetings)

    greet_handle = await session.say(text=greeting, allow_interruptions=False)

    await greet_handle.wait_for_playout()

    reset_timeout()

    monitor_task = asyncio.create_task(monitor_interaction())
    # Expose the task so other components (e.g., tools) can cancel it when needed
    session.userdata.monitor_task = monitor_task

    # Example starter message via data-channel
    await ctx.room.local_participant.send_text("Agent v1.14.0", topic="agent_version")


# ----------------------------------------------------------------------
# Convenience bootstrap (so `python -m voice_agent` just works) ---------
# ----------------------------------------------------------------------


def run_from_cli() -> None:
    """Spawn a LiveKit worker using :pyfunc:`entrypoint`.

    Tuned for low-concurrency, paid-session workloads on small containers
    (e.g. Railway hobby): no idle pre-warm pool (was the cause of EAGAIN
    thread-spawn panics), back-pressure when one session is loaded, hard
    per-job memory cap so a runaway job dies cleanly instead of leaking
    threads into the cgroup.
    """
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            num_idle_processes=0,
            load_threshold=0.6,
            job_memory_limit_mb=800,
        )
    )
