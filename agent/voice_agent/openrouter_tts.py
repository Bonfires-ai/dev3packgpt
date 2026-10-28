"""OpenRouter TTS — fallback used when no ElevenLabs key is configured.

Calls OpenRouter's OpenAI-compatible `/audio/speech` endpoint. We can't reuse
`livekit.plugins.openai.TTS` here: it pipes every response through a container
decoder, while several OpenRouter TTS models only return raw PCM. This class
requests PCM (16-bit, 24kHz, mono) and feeds the bytes straight into frames.

Default is Grok Voice: cheapest model with conversational latency on
OpenRouter (~1s to first byte, $15/1M chars, auto-detects French). Models
that return PCM at a different rate (e.g. HeyGen at 44.1kHz) are rejected.
"""

from __future__ import annotations

import httpx
from livekit.agents import (
    APIConnectionError,
    APIConnectOptions,
    APIStatusError,
    APITimeoutError,
    tts,
    utils,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

OPENROUTER_TTS_SAMPLE_RATE = 24000
OPENROUTER_TTS_CHANNELS = 1
DEFAULT_MODEL = "x-ai/grok-voice-tts-1.0"
DEFAULT_VOICE = "eve"


class TTS(tts.TTS):
    def __init__(
        self,
        *,
        api_key: str,
        model: str = DEFAULT_MODEL,
        voice: str = DEFAULT_VOICE,
        base_url: str = "https://openrouter.ai/api/v1",
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=OPENROUTER_TTS_SAMPLE_RATE,
            num_channels=OPENROUTER_TTS_CHANNELS,
        )
        self._api_key = api_key
        self._model = model
        self._voice = voice
        self._url = f"{base_url.rstrip('/')}/audio/speech"
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=10))

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> ChunkedStream:
        return ChunkedStream(tts=self, input_text=text, conn_options=conn_options)

    async def aclose(self) -> None:
        await self._client.aclose()


class ChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: TTS, input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._or_tts = tts

    async def _run(self) -> None:
        request_id = utils.shortuuid()
        audio_bstream = utils.audio.AudioByteStream(
            sample_rate=OPENROUTER_TTS_SAMPLE_RATE,
            num_channels=OPENROUTER_TTS_CHANNELS,
        )
        emitter = tts.SynthesizedAudioEmitter(event_ch=self._event_ch, request_id=request_id)

        try:
            async with self._or_tts._client.stream(
                "POST",
                self._or_tts._url,
                headers={"Authorization": f"Bearer {self._or_tts._api_key}"},
                json={
                    "model": self._or_tts._model,
                    "voice": self._or_tts._voice,
                    "input": self.input_text,
                    "response_format": "pcm",
                },
            ) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode(errors="replace")
                    raise APIStatusError(body, status_code=resp.status_code, request_id=request_id, body=body)

                content_type = resp.headers.get("content-type", "")
                if "rate=" in content_type and f"rate={OPENROUTER_TTS_SAMPLE_RATE}" not in content_type:
                    raise APIStatusError(
                        f"{self._or_tts._model} returned {content_type}, expected {OPENROUTER_TTS_SAMPLE_RATE}Hz PCM",
                        status_code=resp.status_code,
                        request_id=request_id,
                    )

                async for chunk in resp.aiter_bytes():
                    for frame in audio_bstream.write(chunk):
                        emitter.push(frame)

            for frame in audio_bstream.flush():
                emitter.push(frame)
            emitter.flush()
        except httpx.TimeoutException:
            raise APITimeoutError() from None
        except APIStatusError:
            raise
        except Exception as e:
            raise APIConnectionError() from e
