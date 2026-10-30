from __future__ import annotations

import asyncio
import json
import os
import re
import time
from asyncio import Task
from typing import AsyncIterable, Optional
from dataclasses import dataclass

from livekit.agents import (
    mcp,
    AgentSession,
    AutoSubscribe,
    ChatContext,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, elevenlabs, openai
from livekit.plugins.elevenlabs import VoiceSettings
from livekit.plugins.turn_detector.english import EnglishModel
import requests
from voice_agent.persona_config import (
    VOICE_SPEED,
    VOICE_STABILITY,
    VOICE_SIMILARITY_BOOST,
    VOICE_STYLE,
    VOICE_USE_SPEAKER_BOOST,
    DEEPGRAM_LANGUAGE_BY_MOOD,
    DEFAULT_PERSONA,
    PERSONAS,
)
from voice_agent.stt_words import stt_words
from voice_agent.assistant import Assistant, end_session, prewarm
from voice_agent import bonfires
from voice_agent.constants import (
    build_prompt,
    ELEVENLABS_DEFAULT_VOICE_ID,
    TIMEOUT_WARNING_TIME,
    TIMEOUT_SECONDS,
    mood_greeting,
)
from voice_agent.logger import get_logger

logger = get_logger()

_active_tasks = set()


@dataclass
class SessionInfo:
    room_id: str | None = None
    mood: str | None = None
    monitor_task: Task[None] | None = None
    ending: bool = False


async def async_handle_user_end_conversation(
    reader, participant_identity, ctx: JobContext, session: AgentSession
):
    await reader.read_all()

    try:
        await session.interrupt()
    except Exception:
        await session.current_speech.wait_for_playout()

    # The End button skips the LLM: post the fixed goodbye and close.
    await end_session(session, ctx.room)


def handle_user_end_conversation(
    reader, participant_identity, ctx: JobContext, session: AgentSession
):
    task = asyncio.create_task(
        async_handle_user_end_conversation(reader, participant_identity, ctx, session)
    )
    _active_tasks.add(task)
    task.add_done_callback(lambda t: _active_tasks.remove(t))


async def async_handle_agent_audio_muted(reader, session: AgentSession):
    muted = (await reader.read_all()).strip() == "true"
    logger.info("Agent audio %s by user", "muted" if muted else "unmuted")
    # Toggling audio output mid-reply rotates the transcript synchronizer and
    # drops the rest of that reply's text, so let the current reply finish
    # first. The client already silences playback locally the moment it mutes.
    speech = session.current_speech
    if speech is not None:
        await speech.wait_for_playout()
    # With audio output off, replies skip TTS entirely and go out as text
    # transcriptions only, so a muted session makes no TTS calls.
    session.output.set_audio_enabled(not muted)


def handle_agent_audio_muted(reader, session: AgentSession):
    task = asyncio.create_task(async_handle_agent_audio_muted(reader, session))
    _active_tasks.add(task)
    task.add_done_callback(lambda t: _active_tasks.remove(t))


# A URL stops at whitespace or a parenthesis and gives back trailing punctuation,
# so "(https://x.y/z)." loses the URL but keeps ")." for _EMPTY_PARENS_RE.
_URL_RE = re.compile(r"(?:https?://|www\.)[^\s()<>]*[^\s()<>.,;:!?'\"]")
_EMPTY_PARENS_RE = re.compile(r"\s*\(\s*\)")


async def strip_urls(text: AsyncIterable[str]) -> AsyncIterable[str]:
    """Drop URLs from the text sent to TTS.

    Only the TTS input passes through here, so cited links still show in the
    text transcript but are never spoken. A chunk is held back from its last
    whitespace on, so a URL split across chunks is removed whole.
    """
    buffer = ""
    async for chunk in text:
        buffer += chunk
        cut = max(buffer.rfind(" "), buffer.rfind("\n"))
        if cut == -1:
            continue
        ready, buffer = buffer[: cut + 1], buffer[cut + 1 :]
        yield _EMPTY_PARENS_RE.sub("", _URL_RE.sub("", ready))
    if buffer:
        yield _EMPTY_PARENS_RE.sub("", _URL_RE.sub("", buffer))


async def entrypoint(ctx: JobContext):  # noqa: C901 – keep high complexity for now
    """Entrypoint for LiveKit worker processes.

    This function closely mirrors the original implementation in *main.py* but is
    organised for readability. The LiveKit lifecycle (connect → create session →
    event-loop) remains unchanged so behaviour stays identical.
    """

    # ---------------------------------------------------------------------
    # The dispatch (see the client's /api/connection-details) carries the
    # member's OpenRouter key and what this session is: persona, language and
    # MCP server. The agent has no key of its own, so without one it does not
    # join.
    # ---------------------------------------------------------------------
    try:
        dispatch = json.loads(ctx.job.metadata or "{}")
    except json.JSONDecodeError:
        dispatch = {}
    if not isinstance(dispatch, dict):
        dispatch = {}
    openrouter_api_key = dispatch.get("openrouter_api_key")
    if not openrouter_api_key:
        logger.error("No OpenRouter key in the dispatch for room %s — not joining", ctx.room.name)
        return

    persona = dispatch.get("persona") or DEFAULT_PERSONA
    if persona not in PERSONAS:
        logger.error("Unknown persona %r in the dispatch for room %s — not joining", persona, ctx.room.name)
        return

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

    # The language is the mood; older clients only put it in the room name prefix.
    mood = dispatch.get("language") or ctx.room.name.split("_")[0]
    if mood not in DEEPGRAM_LANGUAGE_BY_MOOD:
        logger.warning("Unknown language %r – using english", mood)
        mood = "english"
    logger.info("Session: persona=%s, language=%s", persona, mood)

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

    system_prompt = build_prompt(persona, mood, primed_context=primed_context)

    # ------------------------------------------------------------------
    # Create the Agent session with STT/LLM/TTS building blocks
    # ------------------------------------------------------------------
    deepgram_language = DEEPGRAM_LANGUAGE_BY_MOOD[mood]
    voice_id = PERSONAS[persona]["voice_id"].get(mood) or os.environ.get("ELEVEN_VOICE_ID", ELEVENLABS_DEFAULT_VOICE_ID)
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
        stt_kwargs["keyterm"] = stt_words

    # ElevenLabs carries the cloned Solène voices. Without an ElevenLabs key,
    # fall back to OpenRouter TTS (stock voice) on the member's key, as the LLM.
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
        # Grok Voice: cheapest OpenRouter TTS with conversational latency (~1s to
        # first byte, $15/1M chars), auto-detects Spanish. Returns 24kHz PCM, the
        # rate the openai plugin assumes.
        logger.warning("ELEVEN_API_KEY not set — falling back to OpenRouter TTS")
        session_tts = openai.TTS(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key,
            model=os.environ.get("OPENROUTER_TTS_MODEL", "x-ai/grok-voice-tts-1.0"),
            voice=os.environ.get("OPENROUTER_TTS_VOICE", "eve"),
            response_format="pcm",
        )

    # Bonfires MCP server (mcp-server/ in dev3pack-mcp) for the knowledge tools.
    # The dispatch names it; its URL and key are the agent's MCP_<NAME>_URL and
    # MCP_<NAME>_KEY secrets (a key from that server's MCP_API_KEYS). One per
    # session, since every server has the same tool names.
    mcp_name = dispatch.get("mcp_server") or ""
    mcp_env = re.sub(r"[^A-Z0-9]", "_", mcp_name.upper())
    mcp_url = os.environ.get(f"MCP_{mcp_env}_URL") if mcp_env else None
    mcp_server = None
    if mcp_url:
        logger.info("Knowledge tools from %s (%s)", mcp_url, mcp_name)
        mcp_server = mcp.MCPServerHTTP(
            url=mcp_url,
            headers={"Authorization": f"Bearer {os.environ.get(f'MCP_{mcp_env}_KEY', '')}"},
            allowed_tools=["search_documents", "search_knowledge_graph"],
            client_session_timeout_seconds=15,
        )
    else:
        logger.warning("No MCP server %r configured — agent has no knowledge tools", mcp_name)

    session = AgentSession(
        stt=deepgram.STT(**stt_kwargs),
        llm=openai.LLM(
            model=os.environ.get("LLM_MODEL", "z-ai/glm-5.3-flash"),
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key,
        ),
        tts=session_tts,
        # Defaults plus strip_urls: cited links stay in the text, out of the voice.
        tts_text_transforms=["filter_markdown", "filter_emoji", strip_urls],
        vad=ctx.proc.userdata["vad"],
        turn_handling={"turn_detection": EnglishModel()},
        userdata=SessionInfo(),
    )

    session.userdata.room_id = room_id
    session.userdata.mood = mood

    # The client shows the greeting as soon as the room connects, without voice,
    # so it only needs to be in the history for the LLM to know it was said.
    chat_ctx = ChatContext.empty()
    chat_ctx.add_message(role="assistant", content=mood_greeting[mood])

    # Agent that will power the conversation
    agent = Assistant(system_prompt, mcp_server=mcp_server, chat_ctx=chat_ctx)

    # ------------------------------------------------------------------
    # Local state tracking – kept as simple primitives to avoid overhead
    # ------------------------------------------------------------------
    last_interaction_time: Optional[float] = time.time()
    still_there_prompt_sent = False
    is_agent_speaking = False
    is_user_speaking = False

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

    # Typed messages (lk.chat) never change the user's speaking state, and a
    # muted agent reply is text only, so count every new message as activity.
    @session.on("conversation_item_added")
    def _on_conversation_item_added(ev):
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

    ctx.room.register_text_stream_handler(
        "agent_audio_muted",
        lambda reader, participant_identity: handle_agent_audio_muted(reader, session),
    )

    # ------------------------------------------------------------------
    # Kick off the conversation -----------------------------------------
    # ------------------------------------------------------------------

    await session.start(room=ctx.room, agent=agent)

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
            # Explicit dispatch only: the client dispatches the agent with the
            # member's OpenRouter key, so it never joins a room on its own.
            agent_name=os.environ.get("LIVEKIT_AGENT_NAME", "dev3pack_instructor"),
            num_idle_processes=0,
            load_threshold=0.6,
            job_memory_limit_mb=800,
        )
    )
