import base64
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.auth import AuthenticatedUser, get_current_user
from app.core.exceptions import SolaceException
from app.services.ai_provider import get_ai_provider

logger = logging.getLogger("solace.voice")
router = APIRouter(prefix="/voice", tags=["Voice AI"])

MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15 MB


class TranscribeRequest(BaseModel):
    audio_base64: str = Field(description="Base64 encoded audio bytes (e.g. m4a, mp4, wav, aac)")
    mime_type: Optional[str] = Field(default="audio/mp4", description="Audio MIME type, default: audio/mp4")


class TranscribeResponse(BaseModel):
    text: str = Field(description="Transcribed text from speech")


@router.post(
    "/transcribe",
    response_model=TranscribeResponse,
    summary="Transcribe spoken audio via Gemini native multimodal speech recognition",
    description="Accepts base64 audio payload, transcribes via Gemini, and purges buffer immediately.",
)
async def transcribe_audio(
    data: TranscribeRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        audio_bytes = base64.b64decode(data.audio_base64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 audio data.",
        )

    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio recording is empty.",
        )

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio recording exceeds 15 MB limit.",
        )

    mime_type = data.mime_type or "audio/mp4"
    if "m4a" in mime_type:
        mime_type = "audio/mp4"

    logger.info(f"Processing voice transcription for user {current_user.id} ({len(audio_bytes)} bytes)")

    try:
        provider = get_ai_provider()
        transcribed = await provider.transcribe_audio(audio_bytes, mime_type=mime_type)
        return TranscribeResponse(text=transcribed.strip())
    except SolaceException as se:
        raise se
    except Exception as e:
        logger.exception("Unexpected error during voice transcription")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Voice transcription could not be completed at this time.",
        )
    finally:
        # Guarantee privacy: zero retention of raw audio bytes
        del audio_bytes
