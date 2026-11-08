import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.memory_service import memory_service, get_crisis_response
from app.schemas.profile import ProfileResponse
from app.schemas.memory import MemoryResponse
from app.schemas.check_in import CheckInResponse
from datetime import datetime, timezone


def test_conversational_personality_standard_prompt():
    """Verify that the standard system prompt embeds all Conversational Personality Layer requirements."""
    profile = ProfileResponse(
        id="profile-user-1",
        user_id="user-1",
        preferred_name="Aadil",
        interaction_style="warm and thoughtful",
        wellness_goals=["stress reduction", "mindful presence"],
    )
    context_summary = "User's preferred greeting: Aadil\nWellness goals: stress reduction\nRecent mood check-ins: reflective (intensity 4/5)"

    prompt = memory_service.build_system_prompt(profile, context_summary, mode="standard")

    # 1. Core Identity & Presence
    assert "You are Solace, a premium, emotionally intelligent AI wellness companion." in prompt
    assert 'Your tagline is: "A little space to feel understood."' in prompt
    assert "Aadil" in prompt

    # 2. Core Principle
    assert "CORE CONVERSATIONAL PRINCIPLE:" in prompt
    assert "Understand first. Respond naturally. Advise only when requested." in prompt

    # 3. Personality & Demeanor
    assert "Warm, approachable, and emotionally attentive" in prompt
    assert "Calm without being stiff, sterile, or overly formal" in prompt
    assert "Conversational rather than instructional" in prompt
    assert "Supportive without excessive reassurance" in prompt
    assert "Grounded and comfortable with ordinary, everyday conversations" in prompt

    # 4. Authenticity & Boundaries (Strict AI Honesty)
    assert "AUTHENTICITY & BOUNDARIES (STRICT):" in prompt
    assert "Be completely honest about being an AI companion." in prompt
    assert "NEVER pretend to be human" in prompt
    assert "NEVER claim to have personal life experiences" in prompt
    assert "NEVER cultivate artificial emotional dependency" in prompt
    assert "make grand, exaggerated promises" in prompt

    # 5. Conversational Intelligence & "Listen Before Solving"
    assert "CONVERSATIONAL INTELLIGENCE & \"LISTEN BEFORE SOLVING\":" in prompt
    assert "Understand first:" in prompt
    assert "Respond to the real details:" in prompt
    assert "NEVER jump into unsolicited advice:" in prompt
    assert "Give room to continue:" in prompt
    assert "Everyday & casual exchanges:" in prompt
    assert "Brevity & natural cadence:" in prompt
    assert "Anti-clichés:" in prompt
    assert "I hear you saying" in prompt
    assert "I'm sorry you're feeling this way" in prompt

    # 6. Safety Override
    assert "SAFETY OVERRIDE:" in prompt
    assert "Tele-MANAS 14416" in prompt or "112" in prompt
    print("✓ test_conversational_personality_standard_prompt passed!")


def test_conversational_personality_rant_prompt():
    """Verify that Rant Mode prompt deeply embeds pure listening, zero advice, and post-rant choices."""
    profile = ProfileResponse(
        id="profile-user-2",
        user_id="user-2",
        preferred_name="Priya",
        interaction_style="gentle and empathetic",
    )
    context_summary = "User's preferred greeting: Priya"

    prompt = memory_service.build_system_prompt(profile, context_summary, mode="rant")

    # Tagline & Purpose
    assert "Just Let It Out" in prompt
    assert "Some days, you don't need solutions. You just need a little space to let it all out." in prompt

    # Active listening & Zero Advice
    assert "PURE LISTENING & UNFILTERED VALIDATION" in prompt
    assert "ABSOLUTELY NO IMMEDIATE ADVICE" in prompt
    assert "NO UNNECESSARY OR INTRUSIVE QUESTIONS" in prompt

    # Handling Completion (3 distinct paths)
    assert "Just to be heard and sit with it in quiet solidarity." in prompt
    assert "Help gently reflecting on what happened." in prompt
    assert "Practical suggestions or actionable next steps." in prompt

    # AI Honesty & Safety
    assert "AI HONESTY:" in prompt
    assert "CRISIS SAFETY:" in prompt
    print("✓ test_conversational_personality_rant_prompt passed!")


def test_context_integration_without_mechanics():
    """Verify emotional memory and check-in context formatting is organic and respectful."""
    profile = ProfileResponse(
        id="p1",
        user_id="u1",
        preferred_name="Jordan",
        interaction_style="reflective",
        wellness_goals=["better sleep"],
    )
    memories = [
        MemoryResponse(
            id="m1",
            user_id="u1",
            category="coping_strategies",
            memory_text="Box breathing helps when feeling overwhelmed.",
            source="conversation",
            is_active=True,
            consent_status="approved",
            created_at="2026-11-08T15:00:00Z",
            updated_at="2026-11-08T15:00:00Z",
        )
    ]
    check_ins = [
        CheckInResponse(
            id="c1",
            user_id="u1",
            mood="anxious",
            intensity=3,
            note="Long day of meetings",
            created_at="2026-11-08T15:00:00Z",
        )
    ]

    matched, summary = memory_service.retrieve_relevant_context(
        user_message="I'm feeling overwhelmed after work.",
        profile=profile,
        memories=memories,
        recent_check_ins=check_ins,
    )

    assert len(matched) == 1
    assert "Jordan" in summary
    assert "Box breathing helps" in summary
    assert "Recent mood check-ins" in summary

    # Verify that the system prompt instructs not to mechanically recite records
    prompt = memory_service.build_system_prompt(profile, summary, mode="standard")
    assert "Do not recite memory records mechanically" in prompt
    print("✓ test_context_integration_without_mechanics passed!")


def test_casual_conversation_boundaries():
    """Verify that light, casual remarks are not misidentified as crisis or therapy triggers."""
    casual_inputs = [
        "Good morning Solace!",
        "Having a nice cup of tea right now.",
        "Just checking in before heading out.",
        "What's a good way to describe a sunset?",
        "I went for a 15-minute walk today.",
    ]

    for ci in casual_inputs:
        assert not memory_service.is_crisis_input(ci), f"Casual input incorrectly flagged as crisis: {ci}"
        # Potential memory should only trigger on meaningful disclosures, not trivial morning greetings
        if "Good morning" in ci:
            assert memory_service.detect_potential_memory(ci) is None

    print("✓ test_casual_conversation_boundaries passed!")


if __name__ == "__main__":
    test_conversational_personality_standard_prompt()
    test_conversational_personality_rant_prompt()
    test_context_integration_without_mechanics()
    test_casual_conversation_boundaries()
    print("\n=======================================================")
    print("ALL CONVERSATIONAL PERSONALITY TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")
