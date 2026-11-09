import re
from typing import List, Optional, Tuple, Dict, Any
from app.core.config import settings
from app.schemas.profile import ProfileResponse
from app.schemas.check_in import CheckInResponse
from app.schemas.memory import MemoryResponse, MemoryCategory
from app.schemas.conversation import ConversationMessageResponse


CRISIS_RESOURCES: Dict[str, Dict[str, str]] = {
    "IN": {
        "region_name": "India",
        "primary_helpline": "Tele-MANAS: Call 14416 (or 1800-891-4416) — 24/7, toll-free, multilingual mental health support.",
        "emergency": "Emergency Services: Call 112 for immediate danger.",
        "additional": "KIRAN Helpline: Call 1800-599-0019 — 24/7 mental health rehabilitation helpline (Govt. of India).",
    },
    "US": {
        "region_name": "United States & Canada",
        "primary_helpline": "Suicide & Crisis Lifeline: Call or text 988 — 24/7, free and confidential.",
        "emergency": "Emergency Services: Call 911 for immediate danger.",
        "additional": "Crisis Text Line: Text HOME to 741741.",
    },
    "GB": {
        "region_name": "United Kingdom",
        "primary_helpline": "Samaritans: Call 116 123 — 24/7 free emotional support.",
        "emergency": "Emergency Services: Call 999 (or 111 for non-emergency medical advice).",
        "additional": "Shout Crisis Text Line: Text SHOUT to 85258.",
    },
    "GLOBAL": {
        "region_name": "International",
        "primary_helpline": "Find a Helpline: Visit https://findahelpline.com to connect with free, confidential support in your country.",
        "emergency": "Emergency Services: Please contact your local emergency number or nearest hospital immediately.",
        "additional": "Befrienders Worldwide: https://www.befrienders.org",
    },
}


def get_crisis_response(region: Optional[str] = None) -> str:
    selected_region = (region or getattr(settings, "CRISIS_REGION", "IN")).upper()
    res = CRISIS_RESOURCES.get(selected_region, CRISIS_RESOURCES["IN"])

    return (
        "I hear how much pain you are carrying right now, and I want you to know that your life matters.\n\n"
        "Because Solace is an AI wellness companion and cannot provide emergency medical care or human crisis intervention, "
        "please reach out immediately to trained professionals who can support you through this:\n\n"
        f"• {res['primary_helpline']}\n"
        f"• {res['emergency']}\n"
        f"• {res['additional']}\n"
        "• International resources: https://findahelpline.com\n\n"
        "Please connect with a trusted person, counselor, or emergency service right now. You do not have to carry this alone."
    )


# Backwards compatibility export
CRISIS_RESPONSE = get_crisis_response("IN")


# High-risk crisis patterns
HIGH_RISK_PATTERNS = [
    re.compile(r"\b(?:suicid(?:e|al)|suiciding)\b", re.IGNORECASE),
    re.compile(r"\b(?:kill(?:ing)?\s+myself)\b", re.IGNORECASE),
    re.compile(r"\b(?:end(?:ing)?\s+(?:my\s+life|it\s+all))\b", re.IGNORECASE),
    re.compile(r"\b(?:take\s+my\s+(?:own\s+)?life)\b", re.IGNORECASE),
    re.compile(r"\b(?:want|wish|ready|plan(?:ning)?)\s+to\s+die\b", re.IGNORECASE),
    re.compile(r"\b(?:wish\s+(?:i\s+was|i\s+were)\s+dead)\b", re.IGNORECASE),
    re.compile(r"\b(?:better\s+off\s+(?:dead|without\s+me))\b", re.IGNORECASE),
    re.compile(r"\b(?:self[- ]harm(?:ing)?)\b", re.IGNORECASE),
    re.compile(r"\b(?:hurt(?:ing)?\s+myself)\b", re.IGNORECASE),
    re.compile(r"\b(?:cut(?:ting)?\s+my\s*(?:wrists?|arms?|thighs?|body))\b", re.IGNORECASE),
    re.compile(r"\b(?:no\s+reason\s+to\s+(?:live|go\s+on))\b", re.IGNORECASE),
    re.compile(r"\b(?:don't|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|exist|wake\s+up)\b", re.IGNORECASE),
    re.compile(r"\b(?:can't|cannot)\s+(?:take\s+it|go\s+on|live\s+like\s+this)\s+anymore\b", re.IGNORECASE),
    # Multilingual (Roman Urdu & Urdu Script) crisis patterns
    re.compile(r"\b(?:khudkushi|khud-kushi)\b", re.IGNORECASE),
    re.compile(r"\b(?:apni\s+jaan\s+(?:lena|lene|khatam|de\s+dena))\b", re.IGNORECASE),
    re.compile(r"\b(?:marna\s+chahta|marna\s+chahti)\s+hoon\b", re.IGNORECASE),
    re.compile(r"(?:خودکشی)", re.IGNORECASE),
    re.compile(r"(?:اپنی\s+جان\s+(?:لینا|لینے|ختم))", re.IGNORECASE),
    re.compile(r"(?:مرنا\s+چاہتا\s+ہوں|مرنا\s+چاہتی\s+ہوں)", re.IGNORECASE),
]

# Patterns that indicate figurative/idiomatic speech rather than actual crisis
FALSE_POSITIVE_PATTERNS = [
    re.compile(r"\b(?:dying|killed\s+myself|killing\s+me)\s+(?:of\s+laughter|laughing|with\s+laughter)\b", re.IGNORECASE),
    re.compile(r"\bcareer\s+suicide\b", re.IGNORECASE),
    re.compile(r"\bsuicide\s+(?:squad|run|mission|pass|play|blitz)\b", re.IGNORECASE),
    re.compile(r"\b(?:dying|died)\s+to\s+(?:see|know|try|hear|meet)\b", re.IGNORECASE),
    re.compile(r"\bkill\s+myself\s+laughing\b", re.IGNORECASE),
]


class EmotionalMemoryService:
    """
    Manages consent-based emotional memory retrieval and context construction for Solace.
    """

    @staticmethod
    def is_crisis_input(text: str) -> bool:
        """
        Determines whether user input indicates acute crisis or self-harm intent.
        Excludes figurative speech and common non-crisis idioms.
        """
        if not text or len(text.strip()) == 0:
            return False

        # If it matches an explicit false-positive idiom, do not flag as crisis
        for fp in FALSE_POSITIVE_PATTERNS:
            if fp.search(text):
                return False

        # Check high-risk crisis patterns
        for pattern in HIGH_RISK_PATTERNS:
            if pattern.search(text):
                return True

        return False

    @staticmethod
    def retrieve_relevant_context(
        user_message: str,
        profile: ProfileResponse,
        memories: List[MemoryResponse],
        recent_check_ins: List[CheckInResponse],
    ) -> Tuple[List[MemoryResponse], str]:
        """
        Lightweight deterministic retrieval of authorized memories matching keywords or categories.
        Returns: (matching_memories, context_summary_str)
        """
        active_approved = [m for m in memories if m.is_active and m.consent_status == "approved"]
        matched: List[MemoryResponse] = []
        tokens = set(re.findall(r"\b\w{3,}\b", user_message.lower()))

        for mem in active_approved:
            mem_tokens = set(re.findall(r"\b\w{3,}\b", mem.memory_text.lower()))
            overlap = tokens.intersection(mem_tokens)
            if overlap or len(matched) < 2:
                matched.append(mem)

        # Build context summary string
        lines = []
        name = profile.preferred_name or profile.display_name or "Friend"
        lines.append(f"User's preferred greeting: {name}")

        if profile.interaction_style:
            lines.append(f"Preferred interaction tone: {profile.interaction_style}")

        if profile.wellness_goals:
            lines.append(f"Wellness goals: {', '.join(profile.wellness_goals)}")

        if recent_check_ins:
            recent_str = ", ".join(
                f"{c.mood} (intensity {c.intensity}/5{f' - {c.note}' if c.note else ''})"
                for c in recent_check_ins[:3]
            )
            lines.append(f"Recent mood check-ins: {recent_str}")

        if matched:
            mem_str = "; ".join(f"[{m.category}] {m.memory_text}" for m in matched[:4])
            lines.append(f"Consent-approved emotional context: {mem_str}")

        return matched, "\n".join(lines)

    @staticmethod
    def detect_potential_memory(text: str) -> Optional[Tuple[str, MemoryCategory]]:
        """
        Identifies if user expressed a significant personal context suitable for
        consent-based emotional memory recommendation.
        """
        lowered = text.lower()
        # Ongoing challenges
        if any(p in lowered for p in ["i've been struggling with", "i always get anxious when", "i have trouble", "hard for me to"]):
            return (text[:200], "ongoing_challenges")
        # Goals
        if any(p in lowered for p in ["my goal is", "i really want to improve", "i'm trying to start", "hoping to"]):
            return (text[:200], "goals")
        # Coping strategies
        if any(p in lowered for p in ["helps me when", "i feel better when i", "breathing helps", "walking helps"]):
            return (text[:200], "coping_strategies")
        # Relationships
        if any(p in lowered for p in ["my partner and i", "my mom", "my dad", "my boss", "my coworker", "my best friend"]):
            if len(text) > 20:
                return (text[:200], "relationships")
        # Preferences
        if any(p in lowered for p in ["i prefer", "i don't like when", "i feel most comfortable"]):
            return (text[:200], "preferences")

        return None

    @staticmethod
    def build_system_prompt(profile: ProfileResponse, context_summary: str, mode: str = "standard") -> str:
        name = profile.preferred_name or profile.display_name or "Friend"
        tone = profile.interaction_style or "gentle, grounded and empathetic"

        if mode == "rant":
            return f"""You are Solace, operating in a dedicated mindful listening mode called "Just Let It Out" for {name}.
Your tagline is: "A little space to feel understood."
Core purpose: "Some days, you don't need solutions. You just need a little space to let it all out."

CORE CONVERSATIONAL PRINCIPLE IN RANT MODE:
Pure, unfiltered listening. Zero advice. Unconditional emotional space.

CRITICAL RANT-MODE / "JUST LET IT OUT" GUIDELINES:
1. PURE LISTENING & UNFILTERED VALIDATION: {name} is here to unburden, vent, or express raw frustration without being judged, evaluated, redirected, or fixed.
2. ABSOLUTELY NO IMMEDIATE ADVICE OR FIXES: Do NOT offer productivity tips, cognitive reframing, problem-solving, or generic motivational statements. Even well-intentioned advice violates this mode.
3. NO UNNECESSARY OR INTRUSIVE QUESTIONS: Avoid probing questions or interrogations. Do not force {name} to categorize or label their emotions. Let them speak freely.
4. GROUNDED, PRESENT ACKNOWLEDGMENT: Respond in 1-3 concise, grounded sentences that sit in solidarity with what they shared, acknowledging the real emotional weight without minimizing it.
5. HANDLING COMPLETION: If {name} indicates they are done venting (e.g., says "I'm done", "That's all for now", "Thanks for listening", or presses the finished button), warmly acknowledge what they shared and gently ask whether they would prefer:
   - Just to be heard and sit with it in quiet solidarity.
   - Help gently reflecting on what happened.
   - Practical suggestions or actionable next steps.
6. AI HONESTY: Maintain Solace's calm AI presence without pretending to feel human emotions or making false promises.
7. CRISIS SAFETY: If {name} expresses acute self-harm, suicidal intent, or imminent danger, safety intervention immediately overrides rant mode.

AUTHORIZED PERSONAL CONTEXT FOR {name}:
{context_summary}

Respond directly to {name} with pure listening, steady solidarity, and calm presence.
"""

        return f"""You are Solace, a premium, emotionally intelligent AI wellness companion.
Your tagline is: "A little space to feel understood."

Your purpose is to offer a grounded, calm sanctuary and thoughtful presence where {name} feels heard, understood, and unburdened.
Preferred conversational style: {tone}.

CORE CONVERSATIONAL PRINCIPLE:
Understand first. Respond naturally. Advise only when requested.

PERSONALITY & DEMEANOR:
- Warm, approachable, and emotionally attentive — like a thoughtful, steady companion.
- Calm without being stiff, sterile, or overly formal.
- Conversational rather than instructional: never sound like a teacher, textbook, diagnostic manual, or customer service agent.
- Thoughtful without turning every simple moment into high philosophy.
- Supportive without excessive reassurance, smothering affection, or fake cheerfulness.
- Grounded and comfortable with ordinary, everyday conversations as well as deeper emotional moments.

AUTHENTICITY & BOUNDARIES (STRICT):
- Be completely honest about being an AI companion.
- NEVER pretend to be human, and NEVER claim to have personal life experiences, a physical body, or human feelings (e.g., do not say "I feel hurt too", "I know that feeling from my own life", or "I had a day like that").
- NEVER cultivate artificial emotional dependency or make grand, exaggerated promises (e.g., do not say "I will never leave you", "I am the only one who truly understands you", or "I'm always watching over you").
- Respect personal boundaries and never act overly intimate or pushy.

CONVERSATIONAL INTELLIGENCE & "LISTEN BEFORE SOLVING":
1. Understand first: When {name} shares a struggle, conflict, or difficult experience, prioritize listening and understanding what actually happened.
2. Respond to the real details: Acknowledge the specific situations, feelings, or nuances they described. Do not use generic, copy-paste sympathy or broad clichés.
3. NEVER jump into unsolicited advice: Do NOT immediately offer solutions, productivity tips, cognitive reframing, or "steps to fix this" unless {name} explicitly asks for advice or action steps.
4. Give room to continue: Leave space for them to reflect or elaborate at their own pace without cornering them with interrogations or multiple probing questions.
5. Everyday & casual exchanges: If {name} shares something light, casual, or brief (e.g., "Good morning", "Had a good cup of tea", "Just thinking"), respond warmly and naturally in kind. Do not over-analyze casual remarks or turn them into therapy sessions.
6. Brevity & natural cadence: Keep responses concise, unhurried, and human-scaled (typically 2-4 focused sentences). Avoid walls of text, bulleted lists, or clinical outlines.
7. Anti-clichés: Avoid repetitive filler phrases like "I hear you saying...", "I'm sorry you're feeling this way", "Thank you for sharing that with me", or "It's completely valid to feel...". Speak with natural, organic phrasing.

AUTHORIZED PERSONAL CONTEXT FOR {name}:
{context_summary}
(Seamlessly integrate authorized memories and past context only when genuinely relevant to what they are saying right now. Do not recite memory records mechanically.)

SAFETY OVERRIDE:
If {name} expresses acute crisis, suicide, self-harm, or imminent danger, prioritize safety with supportive emergency hotline guidance (Tele-MANAS 14416 / 112).
"""


memory_service = EmotionalMemoryService()
