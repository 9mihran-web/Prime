from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.voice_service import voice_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])

# Maximum accepted audio file size: 25 MB (OpenAI Whisper hard limit)
MAX_AUDIO_BYTES = 25 * 1024 * 1024


class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    duration_hint: Optional[str] = None


class SynthesisRequest(BaseModel):
    text: str
    voice: str = "alloy"
    response_format: str = "mp3"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe an audio file to text (Whisper)",
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: Optional[str] = Form(
        default=None,
        description="Optional ISO-639-1 language hint (e.g. 'en', 'es').",
    ),
    current_user: User = Depends(get_current_active_user),
) -> TranscriptionResponse:
    """Convert an uploaded audio file to text using OpenAI Whisper.

    Supported formats: MP3, MP4, OGG, WAV, WebM, FLAC, M4A.
    Maximum file size: 25 MB.
    """
    audio_bytes = await file.read()

    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {MAX_AUDIO_BYTES // (1024 * 1024)} MB.",
        )

    content_type = file.content_type or "audio/mpeg"

    try:
        text = await voice_service.transcribe(
            audio_bytes=audio_bytes,
            content_type=content_type,
            language=language,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Transcription failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Transcription service error: {exc}",
        ) from exc

    return TranscriptionResponse(text=text, language=language)


@router.post(
    "/synthesize",
    summary="Convert text to speech (TTS)",
    response_class=Response,
    responses={
        200: {
            "content": {
                "audio/mpeg": {},
                "audio/ogg; codecs=opus": {},
                "audio/aac": {},
                "audio/flac": {},
            },
            "description": "Audio bytes in the requested format.",
        }
    },
)
async def synthesize_speech(
    payload: SynthesisRequest,
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Convert *text* to speech audio.

    - ``voice``: one of ``alloy``, ``echo``, ``fable``, ``onyx``, ``nova``,
      ``shimmer`` (default: ``alloy``).
    - ``response_format``: ``mp3`` (default), ``opus``, ``aac``, ``flac``.

    Returns raw audio bytes with the appropriate ``Content-Type`` header.
    """
    if not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text must not be empty.",
        )
    if len(payload.text) > 4096:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text exceeds the maximum length of 4 096 characters.",
        )

    try:
        audio_bytes, mime_type = await voice_service.synthesize(
            text=payload.text,
            voice=payload.voice,
            response_format=payload.response_format,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("TTS synthesis failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech synthesis service error: {exc}",
        ) from exc

    return Response(
        content=audio_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="speech.{payload.response_format}"',
        },
    )
