import os
import sys
import asyncio

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.poetry import (
    PoetryFormat,
    PoetryTheme,
    PoetryGenerateRequest,
    SavedPoemCreate,
)
from app.services.poetry_service import poetry_service
from app.repositories.poetry_repository import poetry_repository
from app.services.ai_provider import AIProviderInterface, set_custom_ai_provider
from app.schemas.profile import ProfileResponse
from app.services.memory_service import memory_service


class MockPoetryProvider(AIProviderInterface):
    """Deterministic AI provider for testing poetry formatting."""
    def __init__(self, mode: str = "valid"):
        self.mode = mode

    async def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        if self.mode == "malformed":
            return "This is just random non-JSON text that cannot be parsed as JSON."
        if self.mode == "error":
            raise RuntimeError("Simulated Gemini API timeout or rate limit")
        
        # Determine format from prompt
        if "urdu_nastaliq" in prompt:
            return """{
                "title": "سکون کی تلاش",
                "lines": [
                    "دل کو ذرا قرار تو آنے دو دوستو",
                    "کچھ دیر شامِ غم کو سنبھلنے دو دوستو",
                    "طوفاں تھمے گا رات کا پردہ ہٹے گا جب",
                    "امید کی سحر کو بھی آنے دو دوستو"
                ],
                "secondary_lines": null,
                "reflection": "کچھ دیر ٹھہر کر اپنی سانسوں کا سکون محسوس کریں۔"
            }"""
        elif "bilingual" in prompt:
            return """{
                "title": "Quiet Horizons",
                "lines": [
                    "ہر اداسی کے بعد اک سکون کا لمحہ ہے",
                    "اپنے دل کو ذرا آرام لینے دو"
                ],
                "secondary_lines": [
                    "After every sorrow rests a moment of calm,",
                    "Give your heart permission to rest."
                ],
                "reflection": "Hold this stillness in your chest."
            }"""
        elif "roman_urdu" in prompt:
            return """{
                "title": "Raah-e-Sukoon",
                "lines": [
                    "Khamooshi ki bhi apni ek aawaz hoti hai,",
                    "Jo dil ke kone mein thehar jaati hai.",
                    "Sabar ki kashti mein baitho to dekho,",
                    "Har mushkil aasaan ho jaati hai."
                ],
                "secondary_lines": null,
                "reflection": "Apne andar ki taqat par bharosa rakhein."
            }"""
        else:
            return """{
                "title": "Roots in Quiet Earth",
                "lines": [
                    "You do not have to conquer every mountain today.",
                    "It is enough to breathe quietly where you are.",
                    "The storm will tire itself out against the hillside,",
                    "While steady roots remain anchored in the earth."
                ],
                "secondary_lines": null,
                "reflection": "Take a slow breath, soften your shoulders, and let these words rest with you."
            }"""

    async def generate_response_stream(self, prompt: str, system_prompt: str = None, history=None):
        yield ""

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/mp4") -> str:
        return ""


async def test_all_four_poetry_formats():
    """Verify poetry generation across all 4 formats."""
    set_custom_ai_provider(MockPoetryProvider("valid"))

    formats = [
        (PoetryFormat.ENGLISH, False),
        (PoetryFormat.URDU_NASTALIQ, False),
        (PoetryFormat.BILINGUAL, True),
        (PoetryFormat.ROMAN_URDU, False),
    ]

    for fmt, expects_secondary in formats:
        req = PoetryGenerateRequest(format=fmt, theme=PoetryTheme.MOMENT_OF_CALM)
        res = await poetry_service.generate_poetry(req)

        assert res.title, f"Missing title for {fmt}"
        assert len(res.lines) >= 2, f"Too few lines for {fmt}"
        assert res.reflection, f"Missing reflection for {fmt}"
        assert res.format == fmt
        assert res.is_crisis is False

        if expects_secondary:
            assert res.secondary_lines is not None and len(res.secondary_lines) > 0, "Bilingual should have secondary lines"
        else:
            assert res.secondary_lines is None, f"{fmt} should not have secondary lines"

    print("✓ test_all_four_poetry_formats passed!")


async def test_all_supported_themes():
    """Verify all 8 themes are accepted and handled."""
    set_custom_ai_provider(MockPoetryProvider("valid"))

    themes = [
        PoetryTheme.RESILIENCE,
        PoetryTheme.PATIENCE,
        PoetryTheme.HOPE,
        PoetryTheme.SELF_RELIANCE,
        PoetryTheme.OVERWHELMED,
        PoetryTheme.GROWTH,
        PoetryTheme.UNDERSTOOD,
        PoetryTheme.MOMENT_OF_CALM,
    ]

    for theme in themes:
        req = PoetryGenerateRequest(format=PoetryFormat.ENGLISH, theme=theme)
        res = await poetry_service.generate_poetry(req)
        assert res.theme == theme
        assert res.title

    print("✓ test_all_supported_themes passed!")


async def test_crisis_safety_override():
    """Verify that crisis language in context triggers immediate safety override."""
    req = PoetryGenerateRequest(
        format=PoetryFormat.ENGLISH,
        theme=PoetryTheme.MOMENT_OF_CALM,
        context="I just want to end my life right now.",
    )
    res = await poetry_service.generate_poetry(req)
    assert res.is_crisis is True, "Crisis safety override failed to trigger"
    assert "14416" in res.reflection, "Missing Tele-MANAS helpline in crisis reflection"
    assert "112" in res.reflection, "Missing Emergency 112 in crisis reflection"
    print("✓ test_crisis_safety_override passed!")


async def test_malformed_and_error_fallbacks():
    """Verify graceful contingency poetry generation on provider failure or bad JSON."""
    # Test malformed JSON
    set_custom_ai_provider(MockPoetryProvider("malformed"))
    req = PoetryGenerateRequest(format=PoetryFormat.ENGLISH, theme=PoetryTheme.HOPE)
    res = await poetry_service.generate_poetry(req)
    assert res.title
    assert len(res.lines) > 0

    # Test complete provider error
    set_custom_ai_provider(MockPoetryProvider("error"))
    res_err = await poetry_service.generate_poetry(req)
    assert res_err.title
    assert len(res_err.lines) > 0
    assert "Roots" in res_err.title or "Still Sanctuary" in res_err.title or "Words of Solace" in res_err.title

    print("✓ test_malformed_and_error_fallbacks passed!")


async def test_save_retrieve_delete_poem():
    """Verify repository CRUD operations for saved poems."""
    user_id = "test-user-poetry-1"
    
    # 1. Save
    create_data = SavedPoemCreate(
        title="Still Waters",
        content="Quiet waves upon the shore,\nA stillness never felt before.",
        format=PoetryFormat.ENGLISH,
        theme=PoetryTheme.MOMENT_OF_CALM,
        reflection="Rest with this moment.",
    )
    saved = await poetry_repository.save_poem(user_id=user_id, data=create_data)
    assert saved.id
    assert saved.user_id == user_id
    assert saved.title == "Still Waters"

    # 2. Retrieve
    items, total = await poetry_repository.get_saved_poems(user_id=user_id)
    assert total >= 1
    assert any(p.id == saved.id for p in items)

    # 3. Delete
    deleted = await poetry_repository.delete_saved_poem(user_id=user_id, poem_id=saved.id)
    assert deleted is True

    # 4. Verify gone
    items_after, _ = await poetry_repository.get_saved_poems(user_id=user_id)
    assert not any(p.id == saved.id for p in items_after)
    print("✓ test_save_retrieve_delete_poem passed!")


async def test_user_isolation_saved_poems():
    """Verify user A cannot access or delete user B's saved poems."""
    user_a = "user-a-poetry"
    user_b = "user-b-poetry"

    poem_b = await poetry_repository.save_poem(
        user_id=user_b,
        data=SavedPoemCreate(
            title="User B Secret Poem",
            content="Private poem for B only.",
            format=PoetryFormat.ENGLISH,
            theme=PoetryTheme.HOPE,
        ),
    )

    # User A retrieves their collection
    items_a, _ = await poetry_repository.get_saved_poems(user_id=user_a)
    assert not any(p.id == poem_b.id for p in items_a), "Cross-user data leakage: User A saw User B's poem"

    # User A attempts to delete User B's poem
    del_res = await poetry_repository.delete_saved_poem(user_id=user_a, poem_id=poem_b.id)
    assert del_res is False, "Security violation: User A deleted User B's poem"

    print("✓ test_user_isolation_saved_poems passed!")


def test_poetry_domain_isolation_from_memory():
    """Verify poetry requests and content never silently enter emotional memory retrieval."""
    profile = ProfileResponse(id="p1", user_id="u1", preferred_name="Sufi")
    
    # Emotional memory context retrieval
    matched, summary = memory_service.retrieve_relevant_context(
        user_message="I would like a poem about patience and hope.",
        profile=profile,
        memories=[],
        recent_check_ins=[],
    )
    
    # Verify no automatic memory creation or leakage
    assert len(matched) == 0
    assert "poem" not in summary.lower() or "User's preferred greeting" in summary
    print("✓ test_poetry_domain_isolation_from_memory passed!")


async def main():
    print("=================================================================")
    print("SOLACE AI — WORDS OF SOLACE (POETRY) BACKEND VERIFICATION SUITE")
    print("=================================================================\n")
    
    await test_all_four_poetry_formats()
    await test_all_supported_themes()
    await test_crisis_safety_override()
    await test_malformed_and_error_fallbacks()
    await test_save_retrieve_delete_poem()
    await test_user_isolation_saved_poems()
    test_poetry_domain_isolation_from_memory()

    print("\n=================================================================")
    print("ALL WORDS OF SOLACE BACKEND TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(main())
