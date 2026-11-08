import re
import json
import logging
from typing import Optional, Dict, Any, List
from app.core.exceptions import SolaceException
from app.services.ai_provider import get_ai_provider
from app.services.memory_service import memory_service, get_crisis_response
from app.schemas.poetry import (
    PoetryFormat,
    PoetryTheme,
    PoetryGenerateRequest,
    PoetryGenerateResponse,
)

logger = logging.getLogger("solace.poetry")

THEME_GUIDELINES: Dict[PoetryTheme, str] = {
    PoetryTheme.RESILIENCE: "Theme: Quiet resilience — weathering the storm with steady, understated grace; perseverance without false bravado or noisy struggle.",
    PoetryTheme.PATIENCE: "Theme: Patience (Sabar) — trusting the passage of time; allowing seeds to rest in the soil; sitting with the unsettled without rushing to resolution.",
    PoetryTheme.HOPE: "Theme: Hope without forced positivity — an understated dawn; a sliver of light across the floor; acknowledging sorrow while remembering dawn follows dusk.",
    PoetryTheme.SELF_RELIANCE: "Theme: Self-reliance (Khudi / Inner Grounding) — returning to one's own inner center; finding strength in one's own breath; quiet sovereignty.",
    PoetryTheme.OVERWHELMED: "Theme: Feeling overwhelmed — permission to set the heavy burden down; untangling chaotic thoughts; acknowledging exhaustion with compassion.",
    PoetryTheme.GROWTH: "Theme: Personal growth — quiet, unseen transformation; rings forming inside an ancient tree; becoming softer and wiser through life's seasons.",
    PoetryTheme.UNDERSTOOD: "Theme: Feeling understood (Hamrahi) — the soothing quietude of knowing your pain is not strange or isolated; feeling seen in solitude.",
    PoetryTheme.MOMENT_OF_CALM: "Theme: Finding a moment of calm (Sukoon) — evening stillness; tea cooling on the table; the rhythm of easy breathing; tranquil sanctuary.",
}

FORMAT_INSTRUCTIONS: Dict[PoetryFormat, str] = {
    PoetryFormat.ENGLISH: (
        "Format: Contemporary contemplative English lyric poetry.\n"
        "Length: 8 to 14 lines divided into 2-3 gentle stanzas.\n"
        "Tone: Grounded, lyrical, atmospheric, and emotionally resonant. Avoid greeting clichés or forced rhymes.\n"
        "Lines: Return as a list of strings in the 'lines' field. 'secondary_lines' must be null."
    ),
    PoetryFormat.URDU_NASTALIQ: (
        "Format: Authentic Urdu poetry (Nazm or Ghazal couplets) written entirely in authentic Urdu script (Nastaliq characters: مثلاً اردو رسم الخط).\n"
        "Length: 6 to 10 lines (3 to 5 couplets/ash'aar).\n"
        "Tone: Classical or thoughtful modern Urdu aesthetic with nuanced phrasing (nazm/sukoon/sabar/umeed).\n"
        "Lines: Return as a list of Urdu script strings in the 'lines' field. 'secondary_lines' must be null."
    ),
    PoetryFormat.BILINGUAL: (
        "Format: Bilingual poetry (Urdu Script + English poetic translation).\n"
        "Lines ('lines'): 6 to 8 lines in authentic Urdu script (Nastaliq characters).\n"
        "Secondary Lines ('secondary_lines'): Matching 6 to 8 lines in lyrical, faithful English translation.\n"
        "Ensure each line in 'lines' corresponds directly to the parallel line in 'secondary_lines'."
    ),
    PoetryFormat.ROMAN_URDU: (
        "Format: Urdu poetry written in clean Roman/Latin phonetic script (Roman Urdu).\n"
        "Example style: 'Khamooshi ki bhi ek aawaz hoti hai, jo dil ke kone mein thehar jaati hai.'\n"
        "Length: 6 to 10 lines.\n"
        "Tone: Elegant, poignant, using common conversational Roman Urdu spelling without confusing symbols.\n"
        "Lines: Return as a list of Roman Urdu strings in the 'lines' field. 'secondary_lines' must be null."
    ),
}


class PoetryService:
    """
    Dedicated service for generating bespoke, culturally authentic,
    emotionally grounded poetry in English, Urdu, Roman Urdu, and Bilingual formats.
    """

    @staticmethod
    def build_poetry_prompt(request: PoetryGenerateRequest) -> str:
        theme_note = THEME_GUIDELINES.get(request.theme, THEME_GUIDELINES[PoetryTheme.MOMENT_OF_CALM])
        format_note = FORMAT_INSTRUCTIONS.get(request.format, FORMAT_INSTRUCTIONS[PoetryFormat.ENGLISH])
        context_note = f"User's personal context or reflection: '{request.context}'" if request.context else "No extra personal context provided; focus purely on the essence of the theme."

        return f"""You are a master contemplative poet and emotional sanctuary writer for Solace.
Your role is to craft deeply thoughtful, emotionally attuned, and authentic poetry titled 'Words of Solace'.

CRITICAL ARTISTIC PRINCIPLES:
1. NO FORCED POSITIVITY: Never use cheap motivational slogans, toxic optimism, or dismissive cheers. Acknowledge the gravity of human emotion with dignity.
2. NO ROMANTIC OR UNHEALTHY ATTACHMENT: This is a contemplative poem for self-reflection and inner sanctuary.
3. CULTURAL AUTHENTICITY: In Urdu and Roman Urdu formats, use genuine poetic sensibilities (tasawwur, sukoon, sabr, raushni), not robotic literal machine translations.
4. STRUCTURED JSON OUTPUT: You MUST return ONLY a valid JSON object with the exact keys:
   - "title": (string) A concise, evocative title for the poem.
   - "lines": (list of strings) The poetic lines.
   - "secondary_lines": (list of strings or null) Parallel English translation lines if bilingual, otherwise null.
   - "reflection": (string) 1 or 2 calm, mindful closing sentences offering gentle perspective.

SPECIFICATIONS:
{theme_note}

{format_note}

{context_note}

Return ONLY the raw JSON object. Do not wrap in markdown quotes if possible, or use standard ```json.
"""

    async def generate_poetry(self, request: PoetryGenerateRequest) -> PoetryGenerateResponse:
        """
        Generates poetry adhering to format, theme, and deterministic safety rules.
        """
        # 1. Deterministic safety check on user-supplied context
        if request.context and memory_service.is_crisis_input(request.context):
            logger.warning("Poetry generation request intercepted by deterministic crisis detection.")
            crisis_text = get_crisis_response()
            return PoetryGenerateResponse(
                title="A Safe Space for You",
                lines=[
                    "I hear the weight you carry,",
                    "And how heavy this moment feels.",
                    "Please pause and reach for care,",
                    "You do not have to carry this alone.",
                ],
                secondary_lines=None,
                reflection=crisis_text,
                format=request.format,
                theme=request.theme,
                is_crisis=True,
            )

        # 2. Build prompt
        system_prompt = self.build_poetry_prompt(request)
        user_prompt = f"Please craft a poem for theme '{request.theme.value}' in format '{request.format.value}'."
        if request.context:
            user_prompt += f" Incorporate this context gently: {request.context}"

        # 3. Call AI Provider
        try:
            provider = get_ai_provider()
            raw_response = await provider.generate_response(prompt=user_prompt, system_prompt=system_prompt)
            parsed = self._parse_json_response(raw_response)

            return PoetryGenerateResponse(
                title=parsed.get("title", f"Words of Solace — {request.theme.value.title()}"),
                lines=parsed.get("lines", ["In the quiet spaces between thoughts,", "A gentle breath waits."]),
                secondary_lines=parsed.get("secondary_lines"),
                reflection=parsed.get("reflection", "Take a moment to let these words rest with you."),
                format=request.format,
                theme=request.theme,
                is_crisis=False,
            )
        except SolaceException as se:
            raise se
        except Exception as e:
            logger.exception("Unexpected failure during poetry generation")
            # Graceful fallback poem
            fallback = self._get_fallback_poem(request.format, request.theme)
            return fallback

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Safely cleans and parses JSON from model output."""
        cleaned = text.strip()
        # Strip markdown fences if present
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # Find first '{' and last '}'
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx : end_idx + 1]

        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Failed to parse poetry JSON response: {e}. Raw text preview: {text[:120]}")
            # Try line splitting fallback
            lines = [line.strip() for line in text.split("\n") if line.strip() and not line.startswith("{") and not line.startswith("}")]
            return {
                "title": "Words of Solace",
                "lines": lines[:8] if lines else ["In the quiet corners of the day,", "A moment of stillness remains."],
                "secondary_lines": None,
                "reflection": "May these words bring a quiet breath of calm.",
            }

    def _get_fallback_poem(self, format_type: PoetryFormat, theme: PoetryTheme) -> PoetryGenerateResponse:
        """Contingency fallback poem if provider is unreachable."""
        if format_type == PoetryFormat.URDU_NASTALIQ:
            return PoetryGenerateResponse(
                title="سکونِ دل",
                lines=[
                    "ہر اک رات کے دامن میں اک سویرا ہے",
                    "ابھی کچھ دیر ٹھہر جاؤ، جو اندھیرا ہے",
                    "ہوا کے دوش پہ رکھی ہے امید کی شمع",
                    "سکون کا بھی ترے دل میں اک بسیرا ہے",
                ],
                secondary_lines=None,
                reflection="کچھ لمحے خاموشی کے ساتھ اپنے دل کو سنبھلنے کا موقع دیں۔",
                format=format_type,
                theme=theme,
                is_crisis=False,
            )
        elif format_type == PoetryFormat.BILINGUAL:
            return PoetryGenerateResponse(
                title="امید کا دیا — The Lantern of Hope",
                lines=[
                    "ہر اداسی کے بعد اک سکون کا لمحہ ہے",
                    "اپنے دل کو ذرا آرام لینے دو",
                ],
                secondary_lines=[
                    "After every sorrow rests a moment of stillness,",
                    "Give your heart permission to rest.",
                ],
                reflection="Gentle reminder to breathe and give yourself grace.",
                format=format_type,
                theme=theme,
                is_crisis=False,
            )
        elif format_type == PoetryFormat.ROMAN_URDU:
            return PoetryGenerateResponse(
                title="Sukoon Ki Talash",
                lines=[
                    "Khamooshi ki bhi apni ek aawaz hoti hai,",
                    "Jo dil ke kone mein thehar jaati hai.",
                    "Mushkil ghadi bhi aakhir guzar jaati hai,",
                    "Ek naya rasta samne laati hai.",
                ],
                secondary_lines=None,
                reflection="Apne aap ko thoda waqt dein aur saans lein.",
                format=format_type,
                theme=theme,
                is_crisis=False,
            )

        return PoetryGenerateResponse(
            title="A Still Sanctuary",
            lines=[
                "You do not have to conquer every mountain today.",
                "It is enough to breathe quietly where you are.",
                "The storm will tire itself out against the hillside,",
                "While steady roots remain anchored in the earth.",
            ],
            secondary_lines=None,
            reflection="Take a slow breath, soften your shoulders, and let these words rest with you.",
            format=format_type,
            theme=theme,
            is_crisis=False,
        )


poetry_service = PoetryService()
