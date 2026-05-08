from __future__ import annotations

import logging
from typing import Optional

from app.services.ai.openai_service import openai_service

logger = logging.getLogger(__name__)


class VoiceService:
    """High-level voice processing service.

    Delegates to :class:`~app.services.ai.openai_service.OpenAIService` for
    the actual Whisper / TTS API calls; this layer adds any business logic
    (format validation, rate-limiting guards, post-processing, etc.).
    """

    # Supported inbound audio MIME types → file extension hints for Whisper
    SUPPORTED_AUDIO_TYPES: dict[str, str] = {
        "audio/mpeg": "mp3",
        "audio/mp4": "mp4",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/webm": "webm",
        "audio/flac": "flac",
        "audio/x-m4a": "m4a",
        "video/webm": "webm",
        "video/mp4": "mp4",
    }

    # Supported TTS voices
    SUPPORTED_VOICES: list[str] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

    async def transcribe(
        self,
        audio_bytes: bytes,
        content_type: str,
        language: Optional[str] = None,
    ) -> str:
        """Convert audio bytes to text using OpenAI Whisper.

        Args:
            audio_bytes: Raw audio file bytes.
            content_type: MIME type of the uploaded file.
            language: Optional ISO-639-1 hint (``"en"``, ``"es"``, …).

        Returns:
            Transcribed text.

        Raises:
            ValueError: If the content type is not supported.
        """
        ext = self.SUPPORTED_AUDIO_TYPES.get(content_type.lower().split(";")[0].strip())
        if ext is None:
            raise ValueError(
                f"Unsupported audio type '{content_type}'. "
                f"Supported: {', '.join(self.SUPPORTED_AUDIO_TYPES)}"
            )

        # Whisper expects a file-like object with a `.name` attribute
        import io
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = f"audio.{ext}"

        text = await openai_service.transcribe_audio(audio_file, language=language)
        logger.info("Transcribed %d bytes of audio (%s)", len(audio_bytes), content_type)
        return text.strip()

    async def synthesize(
        self,
        text: str,
        voice: str = "alloy",
        response_format: str = "mp3",
    ) -> tuple[bytes, str]:
        """Convert text to speech audio.

        Args:
            text: Text to synthesize (≤ 4 096 characters recommended).
            voice: TTS voice name (default ``alloy``).
            response_format: Output format — ``mp3``, ``opus``, ``aac``,
                or ``flac``.

        Returns:
            ``(audio_bytes, content_type)`` tuple.

        Raises:
            ValueError: If an unsupported voice is requested.
        """
        if voice not in self.SUPPORTED_VOICES:
            raise ValueError(
                f"Unsupported voice '{voice}'. "
                f"Choose from: {', '.join(self.SUPPORTED_VOICES)}"
            )

        format_to_mime: dict[str, str] = {
            "mp3": "audio/mpeg",
            "opus": "audio/ogg; codecs=opus",
            "aac": "audio/aac",
            "flac": "audio/flac",
        }
        mime = format_to_mime.get(response_format, "audio/mpeg")

        audio_bytes = await openai_service.text_to_speech(
            text, voice=voice, response_format=response_format
        )
        logger.info("Synthesized %d chars to audio (%s, voice=%s)", len(text), mime, voice)
        return audio_bytes, mime


# Module-level singleton
voice_service = VoiceService()
