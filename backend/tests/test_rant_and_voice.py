import os
import sys
import json
import base64

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user, AuthenticatedUser
from app.services.ai_provider import set_custom_ai_provider, MockAIProvider
from app.services.memory_service import memory_service
from app.schemas.profile import ProfileResponse

client = TestClient(app)

def test_rant_mode_system_prompt():
    profile = ProfileResponse(
        id="profile-1",
        user_id="user-1",
        preferred_name="Aadil",
        interaction_style="gentle and empathetic"
    )
    prompt_std = memory_service.build_system_prompt(profile, "context: test", mode="standard")
    assert "You are Solace, a premium, emotionally intelligent" in prompt_std

    prompt_rant = memory_service.build_system_prompt(profile, "context: test", mode="rant")
    assert "Just Let It Out" in prompt_rant
    assert "ABSOLUTELY NO IMMEDIATE ADVICE" in prompt_rant
    assert "NO UNNECESSARY OR INTRUSIVE QUESTIONS" in prompt_rant
    assert "CRISIS SAFETY" in prompt_rant
    print("✓ test_rant_mode_system_prompt passed!")

def test_crisis_safety_in_rant_mode():
    crisis_text = "I feel like ending my life"
    assert memory_service.is_crisis_input(crisis_text) is True
    print("✓ test_crisis_safety_in_rant_mode passed!")

def test_voice_transcription_endpoint():
    set_custom_ai_provider(MockAIProvider())

    # Unauthorized test
    unauth = client.post("/api/v1/voice/transcribe", json={"audio_base64": "AAAA"})
    assert unauth.status_code == 401

    # Override current user for authorized test
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="user-voice-test",
        email="voice@solace.ai"
    )

    try:
        fake_audio = base64.b64encode(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00").decode("utf-8")
        res = client.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": fake_audio, "mime_type": "audio/wav"},
            headers={"Authorization": "Bearer fake-token"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "text" in data
        assert len(data["text"]) > 0
        print("✓ test_voice_transcription_endpoint passed with text:", data["text"])
    finally:
        app.dependency_overrides.clear()

if __name__ == "__main__":
    test_rant_mode_system_prompt()
    test_crisis_safety_in_rant_mode()
    test_voice_transcription_endpoint()
    print("ALL RANT AND VOICE BACKEND TESTS PASSED!")
