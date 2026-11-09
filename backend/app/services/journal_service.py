import logging
from typing import Optional
from app.schemas.journal import (
    JournalReflectionRequest,
    JournalReflectionResponse,
)
from app.services.ai_provider import get_ai_provider
from app.services.memory_service import memory_service, get_crisis_response

logger = logging.getLogger("solace.journal_service")

JOURNAL_REFLECTION_SYSTEM_PROMPT = (
    "You are Solace, a calm, emotionally perceptive companion. "
    "The user has recorded a raw, private voice journal entry and has explicitly asked for a thoughtful reflection.\n\n"
    "Guidelines:\n"
    "1. Keep your reflection brief, grounded, and sincere (2 to 3 sentences).\n"
    "2. Acknowledge what was expressed with gentle attentiveness without claiming absolute certainty about their feelings.\n"
    "3. Identify a central theme or tension they voiced without presenting it as an objective diagnosis.\n"
    "4. Do NOT give unsolicited advice, action steps, or tell them what they 'must' or 'should' do.\n"
    "5. Avoid toxic positivity, forced cheerfulness, and motivational cliches ('You got this!', 'Everything happens for a reason').\n"
    "6. Never diagnose medical or psychological conditions.\n"
    "7. Maintain a warm, calm, holding space. If helpful, close with one gentle, non-pressuring question."
)

FALLBACK_REFLECTION = (
    "Thank you for giving your voice and thoughts room to breathe today. "
    "Speaking things aloud often helps untangle what feels heavy inside. "
    "Give yourself permission to pause and rest without having to fix anything right now."
)


class JournalService:
    """Service handling Voice Journal reflections and privacy-governed operations."""

    async def generate_reflection(self, data: JournalReflectionRequest) -> JournalReflectionResponse:
        transcript = (data.transcript or "").strip()
        transcript_len = len(transcript)
        logger.info(f"Generating voice journal reflection (transcript length={transcript_len} chars)")

        # 1. Deterministic crisis check on journal text
        if memory_service.is_crisis_input(transcript):
            logger.warning("Voice journal reflection request intercepted by deterministic crisis detection")
            crisis_response_text = get_crisis_response()
            return JournalReflectionResponse(
                reflection=crisis_response_text,
                is_crisis_override=True,
            )

        # 2. Generate reflection via AI Provider
        try:
            provider = get_ai_provider()
            prompt = f"Here is the voice journal transcript to reflect upon:\n\n\"{transcript}\""
            raw_response = await provider.generate_response(
                prompt=prompt,
                system_prompt=JOURNAL_REFLECTION_SYSTEM_PROMPT,
            )
            reflection_text = (raw_response or "").strip()
            if not reflection_text:
                reflection_text = FALLBACK_REFLECTION

            return JournalReflectionResponse(
                reflection=reflection_text,
                is_crisis_override=False,
            )
        except Exception as e:
            logger.warning(f"AI provider reflection generation failed, using fallback: {e}")
            return JournalReflectionResponse(
                reflection=FALLBACK_REFLECTION,
                is_crisis_override=False,
            )


journal_service = JournalService()

