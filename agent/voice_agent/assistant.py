from __future__ import annotations
import os
import requests

from livekit.agents import Agent, function_tool, get_job_context, JobProcess, RunContext, mcp
from livekit.plugins import silero

from voice_agent.logger import get_logger

logger = get_logger()

# ------------------------------------------------------------------
# Transcript upload ------------------------------------------------
# ------------------------------------------------------------------


def save_conversation(room_id: str, transcript: dict) -> None:
    """Save conversation to the database."""

    # Save to file as backup
    # with open("transcript.json", "w") as f:
    #     json.dump(session.history.to_dict(), f, indent=2)

    datalayer_base_url = os.environ.get("DATALAYER_BASE_URL")
    datalayer_api_key = os.environ.get("DATALAYER_API_KEY")

    if not datalayer_base_url or not datalayer_api_key:
        logger.info(
            "Skipping analytics datalayer call - required environment variables not defined"
        )
        return

    try:
        response = requests.post(
            f"{datalayer_base_url}miscellaneous/austingpt/conversations/{room_id}",
            json={
                "messages": transcript,
            },
            headers={"x_api_key": datalayer_api_key},
        )
        response.raise_for_status()
        logger.info("Successfully saved conversation to database")
    except Exception as e:
        logger.error(f"Failed to save conversation to database: {e}")


# ---------------------------------------------------------------------------
# Pre-warm helpers -----------------------------------------------------------
# ---------------------------------------------------------------------------


def prewarm(proc: JobProcess) -> None:
    """Load heavy models once per worker process.

    The VAD model from *silero* is small but non-trivial to load. Doing it in the
    process bootstrap means follow-up calls can reuse the already loaded model
    via ``proc.userdata``.
    """
    proc.userdata["vad"] = silero.VAD.load()


# ---------------------------------------------------------------------------
# Core Agent ----------------------------------------------------------------
# ---------------------------------------------------------------------------


class Assistant(Agent):
    """Conversation agent that also exposes a *end_conversation* tool."""

    def __init__(self, system_prompt: str, mcp_server: mcp.MCPServer | None = None) -> None:  # noqa: D401
        """Create a new Assistant with *system_prompt* as its instructions.

        *mcp_server* (the Bonfires MCP server) supplies the knowledge tools.
        """
        tools = [mcp.MCPToolset(id="bonfires", mcp_server=mcp_server)] if mcp_server else []
        super().__init__(instructions=system_prompt, tools=tools)

    # ------------------------------------------------------------------
    # Tooling -----------------------------------------------------------
    # ------------------------------------------------------------------

    @function_tool()
    async def end_conversation(
        self,
        context: RunContext,
        end_message: str,
    ) -> None:  # noqa: D401
        """End the conversation gracefully.

        Parameters
        ----------
        end_message:
            A brief, warm closing line spoken to the student before the call ends.
        """

        logger.debug(f"Ending conversation with end_message: {end_message}")

        job_context = get_job_context()
        room = job_context.room

        # Stop listening to the user and cancel monitor task as we are ending the conversation
        context.session.input.set_audio_enabled(False)
        context.session.clear_user_turn()

        monitor_task = context.session.userdata.monitor_task
        if monitor_task is not None and not monitor_task.done():
            monitor_task.cancel()

        await context.session.say(end_message, allow_interruptions=False)

        # The client shows its end-of-session card on this, every time.
        await room.local_participant.send_text("true", topic="conversation_ended")

        save_conversation(context.session.userdata.room_id, context.session.history.to_dict())

        # Drain rather than aclose(): aclose() from inside this tool interrupts the
        # tool's own speech, waits 5s and force-cancels it.
        context.session.shutdown()


# Unused image generation code — For reference only.
def _generate_image():
    pass
    # logger.debug("Generating image")

    # def _generate_image(prompt: str) -> bytes:
    #     """Blocking helper that generates an image and returns its raw bytes.

    #     This function is executed in a background thread via *run_in_executor* to
    #     avoid blocking the event loop with a synchronous HTTP request.
    #     """

    #     oai = OpenAI()
    #     result = oai.images.generate(
    #         model="gpt-image-1",
    #         prompt=prompt,
    #         output_format="png",
    #         quality="high",
    #         size="1024x1536",
    #     )
    #     image_base64 = result.data[0].b64_json
    #     return base64.b64decode(image_base64)

    # loop = asyncio.get_running_loop()
    # image_bytes: bytes = await loop.run_in_executor(
    #     None, partial(_generate_image, image_prompt)
    # )

    # # save image bytes to a file
    # with open("image.png", "wb") as f:
    #     f.write(image_bytes)

    # logger.debug("Image Generated - Streaming image")

    # # Stream the image bytes in manageable chunks (recommended max 15KB each)
    # writer = await room.local_participant.stream_bytes(
    #     name="end_conversation_image",
    #     topic="end_conversation_image",
    #     mime_type="image/png",
    # )

    # chunk_size = 15_000  # 15 KB per chunk, recommended max chunk size -> @ref https://docs.livekit.io/home/client/data/byte-streams/#streaming-bytes
    # for idx in range(0, len(image_bytes), chunk_size):
    #     await writer.write(image_bytes[idx : idx + chunk_size])

    # await writer.aclose()

    # logger.debug("Streamed image, disconnecting from room")
