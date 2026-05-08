from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
from openai import AsyncOpenAI, APIStatusError, APITimeoutError, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Maximum retry attempts for transient OpenAI errors
_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 1.5  # seconds


class OpenAIService:
    """Thin async wrapper around the OpenAI API.

    A single shared instance is created at module level and reused across the
    application lifetime so that the underlying ``httpx.AsyncClient`` connection
    pool is shared efficiently.
    """

    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            max_retries=0,  # we handle retries ourselves
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

    # ------------------------------------------------------------------
    # Chat completion
    # ------------------------------------------------------------------

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Any:
        """Send a chat completion request to OpenAI.

        Args:
            messages: List of ``{"role": ..., "content": ...}`` dicts.
            model: Override the default model from settings.
            stream: If ``True`` returns an async generator yielding text
                deltas; otherwise returns the full response string.
            temperature: Sampling temperature (0–2).
            max_tokens: Hard token cap for the completion.
            tools: Optional list of tool definitions for function calling.

        Returns:
            ``str`` when ``stream=False``, ``AsyncGenerator[str, None]``
            when ``stream=True``.
        """
        resolved_model = model or settings.OPENAI_MODEL

        kwargs: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        if stream:
            return self._stream_completion(kwargs)
        return await self._full_completion(kwargs)

    async def _full_completion(self, kwargs: Dict[str, Any]) -> str:
        """Execute a non-streaming chat completion with retry logic."""
        for attempt in range(_MAX_RETRIES):
            try:
                response = await self._client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or ""
            except RateLimitError:
                wait = _RETRY_BACKOFF_BASE ** attempt
                logger.warning("OpenAI rate limit hit, retrying in %.1fs (attempt %d)", wait, attempt + 1)
                await asyncio.sleep(wait)
            except APITimeoutError:
                wait = _RETRY_BACKOFF_BASE ** attempt
                logger.warning("OpenAI timeout, retrying in %.1fs (attempt %d)", wait, attempt + 1)
                await asyncio.sleep(wait)
            except APIStatusError as exc:
                logger.error("OpenAI API error %d: %s", exc.status_code, exc.message)
                raise
        raise RuntimeError(f"OpenAI request failed after {_MAX_RETRIES} retries")

    async def _stream_completion(
        self, kwargs: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Return an async generator that yields text deltas."""
        for attempt in range(_MAX_RETRIES):
            try:
                async with await self._client.chat.completions.create(**kwargs) as stream:
                    async for chunk in stream:
                        delta = chunk.choices[0].delta.content
                        if delta is not None:
                            yield delta
                return
            except RateLimitError:
                wait = _RETRY_BACKOFF_BASE ** attempt
                logger.warning("OpenAI rate limit (stream), retrying in %.1fs", wait)
                await asyncio.sleep(wait)
            except APITimeoutError:
                wait = _RETRY_BACKOFF_BASE ** attempt
                logger.warning("OpenAI timeout (stream), retrying in %.1fs", wait)
                await asyncio.sleep(wait)
            except APIStatusError as exc:
                logger.error("OpenAI stream API error %d: %s", exc.status_code, exc.message)
                raise
        raise RuntimeError(f"OpenAI streaming request failed after {_MAX_RETRIES} retries")

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    async def embed_text(self, text: str) -> List[float]:
        """Return a dense embedding vector for *text*.

        Uses ``text-embedding-3-small`` by default (configurable via
        ``OPENAI_EMBEDDING_MODEL``).
        """
        for attempt in range(_MAX_RETRIES):
            try:
                response = await self._client.embeddings.create(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    input=text,
                )
                return response.data[0].embedding
            except RateLimitError:
                await asyncio.sleep(_RETRY_BACKOFF_BASE ** attempt)
            except APIStatusError as exc:
                logger.error("Embedding API error: %s", exc)
                raise
        raise RuntimeError("Embedding request failed after retries")

    # ------------------------------------------------------------------
    # Whisper transcription
    # ------------------------------------------------------------------

    async def transcribe_audio(self, audio_file: Any, language: Optional[str] = None) -> str:
        """Transcribe an audio file using OpenAI Whisper.

        Args:
            audio_file: A file-like object or path accepted by the API.
            language: Optional ISO-639-1 language code hint (e.g. ``"en"``).

        Returns:
            Transcribed text string.
        """
        kwargs: Dict[str, Any] = {
            "model": settings.OPENAI_WHISPER_MODEL,
            "file": audio_file,
            "response_format": "text",
        }
        if language:
            kwargs["language"] = language

        for attempt in range(_MAX_RETRIES):
            try:
                result = await self._client.audio.transcriptions.create(**kwargs)
                # When response_format="text" the SDK returns a plain str
                return result if isinstance(result, str) else result.text
            except RateLimitError:
                await asyncio.sleep(_RETRY_BACKOFF_BASE ** attempt)
            except APIStatusError as exc:
                logger.error("Whisper API error: %s", exc)
                raise
        raise RuntimeError("Transcription failed after retries")

    # ------------------------------------------------------------------
    # Text-to-Speech
    # ------------------------------------------------------------------

    async def text_to_speech(
        self,
        text: str,
        voice: str = "alloy",
        response_format: str = "mp3",
    ) -> bytes:
        """Synthesize *text* to speech and return raw audio bytes.

        Args:
            text: The text to synthesize (max ~4 096 characters).
            voice: One of ``alloy``, ``echo``, ``fable``, ``onyx``,
                ``nova``, or ``shimmer``.
            response_format: Audio format — ``mp3`` (default), ``opus``,
                ``aac``, or ``flac``.

        Returns:
            Raw audio bytes.
        """
        for attempt in range(_MAX_RETRIES):
            try:
                response = await self._client.audio.speech.create(
                    model=settings.OPENAI_TTS_MODEL,
                    voice=voice,
                    input=text,
                    response_format=response_format,
                )
                return response.content
            except RateLimitError:
                await asyncio.sleep(_RETRY_BACKOFF_BASE ** attempt)
            except APIStatusError as exc:
                logger.error("TTS API error: %s", exc)
                raise
        raise RuntimeError("TTS synthesis failed after retries")

    # ------------------------------------------------------------------
    # Function / tool calling helper
    # ------------------------------------------------------------------

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run a chat completion that may invoke tools.

        Returns the full ``message`` dict from the first choice, which
        may contain ``tool_calls``.
        """
        response = await self._client.chat.completions.create(
            model=model or settings.OPENAI_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        choice = response.choices[0]
        msg = choice.message
        result: Dict[str, Any] = {
            "role": msg.role,
            "content": msg.content or "",
            "tool_calls": [],
            "finish_reason": choice.finish_reason,
        }
        if msg.tool_calls:
            result["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        return result

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.close()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

openai_service = OpenAIService()
