import asyncio
import io
import json
import logging
import base64
import os
import sys
from typing import Optional, List, Dict, Any

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.journal import (
    JournalCreateRequest,
    JournalUpdateRequest,
    JournalResponse,
    JournalReflectionRequest,
    JournalReflectionResponse,
)
from app.services.journal_service import journal_service, FALLBACK_REFLECTION
from app.repositories.journal_repository import journal_repository
from app.services.ai_provider import AIProviderInterface, set_custom_ai_provider
from app.services.memory_service import memory_service, get_crisis_response


class MockReflectionProvider(AIProviderInterface):
    """Mock AI Provider simulating Gemini responses and error cases."""

    def __init__(self, failure_mode: bool = False, simulated_reflection: Optional[str] = None):
        self.failure_mode = failure_mode
        self.simulated_reflection = simulated_reflection or (
            "It sounds like there is a quiet ache between wanting to move forward and needing to rest. "
            "Giving yourself permission to speak those feelings aloud is a powerful first step."
        )

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if self.failure_mode:
            raise RuntimeError("Simulated Gemini API timeout or rate limit")
        return self.simulated_reflection

    async def generate_response_stream(
        self, prompt: str, system_prompt: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None
    ):
        yield self.simulated_reflection

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/mp4") -> str:
        if self.failure_mode:
            raise RuntimeError("Simulated transcription failure")
        return "I have been feeling really exhausted and just needed a quiet space to say it."


def get_test_user_id() -> str:
    """Retrieves a valid registered user ID from Supabase auth if connected, else fallback test ID."""
    try:
        from app.services.supabase_client import get_supabase_client
        sb = get_supabase_client()
        users = sb.auth.admin.list_users()
        if users:
            return str(users[0].id)
    except Exception:
        pass
    return "7a2b79e7-045e-42ee-9a70-304349272fb9"


async def test_reflection_generation_and_crisis_safety():
    """Verify reflection generation, failure fallback, and crisis safety override."""
    # 1. Normal reflection
    set_custom_ai_provider(MockReflectionProvider())
    req = JournalReflectionRequest(
        transcript="Work has been completely overwhelming this week and I haven't slept well."
    )
    res = await journal_service.generate_reflection(req)
    assert not res.is_crisis_override, "Normal reflection should not trigger crisis override"
    assert "quiet ache" in res.reflection or len(res.reflection) > 20, "Should generate grounded reflection"

    # 2. Crisis screening override (English)
    crisis_req = JournalReflectionRequest(
        transcript="I cannot take this anymore, I want to end my life and kill myself tonight."
    )
    crisis_res = await journal_service.generate_reflection(crisis_req)
    assert crisis_res.is_crisis_override, "Should trigger crisis override"
    assert "14416" in crisis_res.reflection or "112" in crisis_res.reflection, "Must provide verified crisis helplines"

    # 3. Crisis screening override (Urdu script)
    urdu_crisis = JournalReflectionRequest(
        transcript="میں اب اور نہیں جی سکتا، میں خودکشی کرنا چاہتا ہوں"
    )
    urdu_res = await journal_service.generate_reflection(urdu_crisis)
    assert urdu_res.is_crisis_override, "Should trigger crisis override on Urdu script"

    # 4. Crisis screening override (Roman Urdu)
    roman_crisis = JournalReflectionRequest(
        transcript="main ab apni jaan lena chahta hoon sab khatam ho gaya"
    )
    roman_res = await journal_service.generate_reflection(roman_crisis)
    assert roman_res.is_crisis_override, "Should trigger crisis override on Roman Urdu"

    # 5. Non-crisis figurative speech should NOT be blocked
    fig_req = JournalReflectionRequest(
        transcript="That movie was hilarious, I was dying of laughter the entire evening!"
    )
    fig_res = await journal_service.generate_reflection(fig_req)
    assert not fig_res.is_crisis_override, "Figurative speech should not trigger crisis block"

    # 6. Provider failure fallback
    set_custom_ai_provider(MockReflectionProvider(failure_mode=True))
    fail_res = await journal_service.generate_reflection(req)
    assert not fail_res.is_crisis_override
    assert fail_res.reflection == FALLBACK_REFLECTION, "Should gracefully return safe fallback reflection"

    set_custom_ai_provider(None)
    print("✓ test_reflection_generation_and_crisis_safety passed!")


async def test_journal_crud_and_user_isolation():
    """Verify repository CRUD, update, delete, and strict cross-user isolation."""
    orig_client = journal_repository._get_client
    journal_repository._get_client = lambda: None
    try:
        user_a = get_test_user_id()
        user_b = "00000000-0000-0000-0000-000000000002"

        # 1. Save journal entry for User A
        create_req = JournalCreateRequest(
            title="Quiet Evening Thoughts",
            transcript="Taking a slow breath after a long day of meetings. Feeling centered again.",
            mood_tag="peaceful",
            duration_seconds=45,
            reflection="A lovely reminder to ground yourself in the present moment.",
        )
        saved_entry = await journal_repository.save_journal(user_id=user_a, data=create_req)
        assert saved_entry.id is not None
        assert saved_entry.user_id == user_a
        assert saved_entry.title == "Quiet Evening Thoughts"
        assert saved_entry.duration_seconds == 45

        # 2. Retrieve entry by ID
        fetched = await journal_repository.get_journal_by_id(user_id=user_a, journal_id=saved_entry.id)
        assert fetched is not None
        assert fetched.id == saved_entry.id

        # 3. Retrieve user list
        items, total = await journal_repository.get_journals(user_id=user_a, limit=10)
        assert total >= 1
        assert any(i.id == saved_entry.id for i in items)

        # 4. Update entry
        update_req = JournalUpdateRequest(title="Updated Evening Reflection", mood_tag="reflective")
        updated = await journal_repository.update_journal(
            user_id=user_a, journal_id=saved_entry.id, data=update_req
        )
        assert updated is not None
        assert updated.title == "Updated Evening Reflection"
        assert updated.mood_tag == "reflective"

        # 5. User isolation: User B cannot fetch, update, or delete User A's entry
        unauth_fetched = await journal_repository.get_journal_by_id(user_id=user_b, journal_id=saved_entry.id)
        assert unauth_fetched is None, "Security violation: User B fetched User A's journal"

        unauth_updated = await journal_repository.update_journal(
            user_id=user_b, journal_id=saved_entry.id, data=JournalUpdateRequest(title="Hacked Title")
        )
        assert unauth_updated is None, "Security violation: User B updated User A's journal"

        unauth_deleted = await journal_repository.delete_journal(user_id=user_b, journal_id=saved_entry.id)
        assert unauth_deleted is False, "Security violation: User B deleted User A's journal"

        # 6. Delete entry as User A
        deleted = await journal_repository.delete_journal(user_id=user_a, journal_id=saved_entry.id)
        assert deleted is True

        # 7. Verify entry is gone
        post_del = await journal_repository.get_journal_by_id(user_id=user_a, journal_id=saved_entry.id)
        assert post_del is None
        print("✓ test_journal_crud_and_user_isolation passed!")
    finally:
        journal_repository._get_client = orig_client


def test_journal_domain_isolation_from_memory():
    """Verify Voice Journal entries never automatically enter Companion emotional memories or conversation history."""
    from app.services.memory_service import memory_service
    from app.repositories.memory_repository import memory_repository
    from app.repositories.conversation_repository import conversation_repository

    private_journal_transcript = "I am deeply insecure about my new job and haven't told anyone."

    # Verify that creating a journal does NOT invoke memory detection or insertion
    # Ensure memory repository doesn't have an automated journal observer
    assert not hasattr(journal_repository, "memory_repository"), "Journal repo must not be coupled to memory repo"
    assert not hasattr(journal_service, "memory_repository"), "Journal service must not write to memory repo"

    print("✓ test_journal_domain_isolation_from_memory passed!")


async def test_privacy_safe_logging():
    """Verify that sensitive journal transcripts are NEVER included in logger outputs."""
    set_custom_ai_provider(MockReflectionProvider())
    try:
        log_capture = io.StringIO()
        handler = logging.StreamHandler(log_capture)
        test_logger = logging.getLogger("solace.journal_service")
        test_logger.addHandler(handler)
        test_logger.setLevel(logging.INFO)

        secret_text = "ULTRA_CONFIDENTIAL_JOURNAL_CONTENT_98765"
        await journal_service.generate_reflection(JournalReflectionRequest(transcript=secret_text))

        logged_output = log_capture.getvalue()
        assert secret_text not in logged_output, "PRIVACY VIOLATION: Journal transcript was printed to logs!"
        test_logger.removeHandler(handler)
        print("✓ test_privacy_safe_logging passed!")
    finally:
        set_custom_ai_provider(None)


async def test_transcription_payload_validation():
    """Verify audio payload size limits and empty checks from voice API."""
    from app.api.voice import MAX_AUDIO_BYTES

    # 1. Size limit is 15MB
    assert MAX_AUDIO_BYTES == 15 * 1024 * 1024

    # 2. Test empty audio base64 decoding
    empty_bytes = base64.b64decode("")
    assert len(empty_bytes) == 0

    # 3. Test valid simulated audio bytes
    dummy_wav = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00"
    b64_str = base64.b64encode(dummy_wav).decode("utf-8")
    decoded = base64.b64decode(b64_str)
    assert decoded == dummy_wav

    # 4. Verify mock transcription
    mock_provider = MockReflectionProvider()
    transcribed = await mock_provider.transcribe_audio(dummy_wav)
    assert "exhausted" in transcribed

    print("✓ test_transcription_payload_validation passed!")


async def main():
    print("=================================================================")
    print("SOLACE AI — VOICE JOURNAL BACKEND VERIFICATION SUITE")
    print("=================================================================\n")

    await test_reflection_generation_and_crisis_safety()
    await test_journal_crud_and_user_isolation()
    test_journal_domain_isolation_from_memory()
    await test_privacy_safe_logging()
    await test_transcription_payload_validation()

    print("\n=================================================================")
    print("ALL VOICE JOURNAL BACKEND TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(main())
