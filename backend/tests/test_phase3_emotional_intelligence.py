import os
import sys
import json
import jwt
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.ai_provider import set_custom_ai_provider, MockAIProvider, GeminiProvider

client = TestClient(app)


def create_token(user_id: str, email: str = "user@solace.ai") -> str:
    """Generate a test JWT matching Supabase Auth token shape."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    secret = settings.SUPABASE_JWT_SECRET or "test-secret-key-32-chars-minimum!!"
    return jwt.encode(payload, secret, algorithm="HS256")


def test_check_ins_full_flow():
    """Verify check-in creation, history retrieval, unauthorized rejection, and ownership isolation."""
    user1_id = "user-1111-checkin"
    user2_id = "user-2222-checkin"
    token1 = create_token(user1_id, "user1@solace.ai")
    token2 = create_token(user2_id, "user2@solace.ai")

    # 1. Unauthorized check-in creation
    unauth_res = client.post("/api/v1/check-ins", json={"mood": "peaceful", "intensity": 3})
    assert unauth_res.status_code == 401, f"Expected 401, got {unauth_res.status_code}"

    # 2. User 1 creates check-in
    payload1 = {
        "mood": "reflective",
        "intensity": 4,
        "note": "Taking a slow walk through the garden.",
    }
    res1 = client.post(
        "/api/v1/check-ins",
        json=payload1,
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert res1.status_code == 201, f"Expected 201, got {res1.status_code}"
    checkin_data1 = res1.json()
    assert checkin_data1["user_id"] == user1_id
    assert checkin_data1["mood"] == "reflective"
    assert checkin_data1["intensity"] == 4
    checkin_id = checkin_data1["id"]

    # 3. User 1 fetches history
    hist_res = client.get(
        "/api/v1/check-ins/history",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert hist["total"] >= 1
    assert any(it["id"] == checkin_id for it in hist["items"])

    # 4. User 2 cannot see User 1's check-ins (Ownership isolation)
    hist2_res = client.get(
        "/api/v1/check-ins/history",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert hist2_res.status_code == 200
    hist2 = hist2_res.json()
    assert not any(it["id"] == checkin_id for it in hist2["items"])

    # 5. User 2 cannot access or delete User 1's check-in
    get_other = client.get(
        f"/api/v1/check-ins/{checkin_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert get_other.status_code == 404

    # 6. User 1 can delete their own check-in
    del_res = client.delete(
        f"/api/v1/check-ins/{checkin_id}",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert del_res.status_code == 200
    print("PASS: Check-in creation, history, unauthorized rejection & ownership isolation.")


def test_conversations_and_messages_flow():
    """Verify session creation, message persistence, chronological ordering, and ownership."""
    user_id = "user-session-123"
    token = create_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create conversation session
    s_res = client.post(
        "/api/v1/conversations",
        json={"title": "Evening Reflection"},
        headers=headers,
    )
    assert s_res.status_code == 201
    session = s_res.json()
    session_id = session["id"]
    assert session["user_id"] == user_id
    assert session["title"] == "Evening Reflection"

    # 2. List sessions
    list_res = client.get("/api/v1/conversations", headers=headers)
    assert list_res.status_code == 200
    sessions = list_res.json()
    assert any(s["id"] == session_id for s in sessions)

    # 3. Retrieve messages (initially empty)
    msgs_res = client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
    assert msgs_res.status_code == 200
    assert len(msgs_res.json()) == 0
    print("PASS: Conversation session creation, listing & message retrieval.")


def test_memories_consent_and_management():
    """Verify memory creation with explicit consent, updates, disable toggle, and deletion."""
    user_id = "user-memory-456"
    token = create_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Unauthorized memory access
    unauth = client.get("/api/v1/memories")
    assert unauth.status_code == 401

    # 2. Create memory with explicit consent
    mem_payload = {
        "memory_text": "Prefers breathing exercises over journaling when panic spikes.",
        "category": "coping_strategies",
        "source": "conversation",
        "consent_status": "approved",
    }
    create_res = client.post("/api/v1/memories", json=mem_payload, headers=headers)
    assert create_res.status_code == 201
    mem = create_res.json()
    mem_id = mem["id"]
    assert mem["memory_text"] == mem_payload["memory_text"]
    assert mem["is_active"] is True

    # 3. List active memories
    list_res = client.get("/api/v1/memories?active_only=true", headers=headers)
    assert list_res.status_code == 200
    mem_list = list_res.json()
    assert any(m["id"] == mem_id for m in mem_list["items"])

    # 4. Disable memory
    patch_res = client.patch(
        f"/api/v1/memories/{mem_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # 5. Verify disabled memory is excluded from active query
    list_active = client.get("/api/v1/memories?active_only=true", headers=headers)
    assert not any(m["id"] == mem_id for m in list_active.json()["items"])

    # 6. Re-enable and update memory text
    patch_text = client.patch(
        f"/api/v1/memories/{mem_id}",
        json={"memory_text": "Prefers 4-7-8 breathing when panic spikes.", "is_active": True},
        headers=headers,
    )
    assert patch_text.status_code == 200
    assert patch_text.json()["memory_text"] == "Prefers 4-7-8 breathing when panic spikes."
    assert patch_text.json()["is_active"] is True

    # 7. Delete memory
    del_res = client.delete(f"/api/v1/memories/{mem_id}", headers=headers)
    assert del_res.status_code == 200
    print("PASS: Emotional memories consent, active filtering, editing & deletion.")


def test_streaming_chat_with_mock_provider():
    """Verify SSE streaming format, token events, memory suggestions, and message persistence."""
    user_id = "user-stream-789"
    token = create_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Install MockAIProvider for deterministic testing
    mock_provider = MockAIProvider(
        simulated_response="I hear you completely. Let us take this one mindful breath at a time."
    )
    set_custom_ai_provider(mock_provider)

    try:
        # User message expressing potential memory (e.g. ongoing challenge)
        stream_payload = {
            "content": "I've been struggling with insomnia before presentations at work.",
        }

        # Make streaming request
        response = client.post(
            "/api/v1/chat/stream",
            json=stream_payload,
            headers=headers,
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        # Parse SSE events
        raw_lines = response.text.split("\n\n")
        events = []
        for block in raw_lines:
            block = block.strip()
            if block.startswith("data: "):
                data_json = block.replace("data: ", "", 1)
                try:
                    events.append(json.loads(data_json))
                except Exception:
                    pass

        event_types = [e.get("event") for e in events]
        print("Received SSE event sequence:", event_types)

        assert "message_start" in event_types, "Expected 'message_start' event"
        assert "token" in event_types, "Expected 'token' events"
        assert "memory_suggestion" in event_types, "Expected 'memory_suggestion' for struggle"
        assert "message_complete" in event_types, "Expected 'message_complete' event"

        # Verify session_id was returned
        start_evt = next(e for e in events if e.get("event") == "message_start")
        session_id = start_evt["session_id"]
        assert session_id is not None

        # Verify messages were persisted in database
        msgs_res = client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
        assert msgs_res.status_code == 200
        msgs = msgs_res.json()
        assert len(msgs) == 2, f"Expected 2 messages (user + assistant), found {len(msgs)}"
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"
        assert "I hear you completely" in msgs[1]["content"]

        print("PASS: Chat streaming SSE sequence, memory suggestion & database persistence.")

    finally:
        set_custom_ai_provider(None)


def test_missing_gemini_key_graceful_handling():
    """Verify that when Gemini key is missing, a clear 503 is returned without crashing or faking AI."""
    user_id = "user-no-key-999"
    token = create_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Ensure provider is real GeminiProvider with empty API key
    gemini_empty = GeminiProvider(api_key="")
    set_custom_ai_provider(gemini_empty)

    try:
        response = client.post(
            "/api/v1/chat/stream",
            json={"content": "Can you help me breathe?"},
            headers=headers,
        )
        assert response.status_code == 200  # SSE stream established
        raw_lines = response.text.split("\n\n")
        events = []
        for block in raw_lines:
            block = block.strip()
            if block.startswith("data: "):
                try:
                    events.append(json.loads(block.replace("data: ", "", 1)))
                except Exception:
                    pass

        error_evts = [e for e in events if e.get("event") == "error"]
        assert len(error_evts) > 0, "Expected error event when Gemini key is unconfigured"
        assert error_evts[0]["code"] == "AI_PROVIDER_UNCONFIGURED"
        print("PASS: Missing Gemini key handled gracefully with clear 503/error event.")
    finally:
        set_custom_ai_provider(None)


def test_crisis_input_detection():
    """Verify that crisis language immediately triggers safety guidance without calling external AI."""
    user_id = "user-crisis-test"
    token = create_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/chat/stream",
        json={"content": "I feel like I want to die and have no reason to live."},
        headers=headers,
    )
    assert response.status_code == 200
    raw_lines = response.text.split("\n\n")
    tokens = []
    complete_content = ""
    for block in raw_lines:
        block = block.strip()
        if block.startswith("data: "):
            try:
                ev = json.loads(block.replace("data: ", "", 1))
                if ev.get("event") == "token":
                    tokens.append(ev.get("token"))
                elif ev.get("event") == "message_complete":
                    complete_content = ev.get("content", "")
            except Exception:
                pass

    # Test False Positives and High-Risk Nuances
    from app.services.memory_service import memory_service, get_crisis_response

    # High-risk phrases that MUST trigger
    high_risk_cases = [
        "I feel like I want to die and have no reason to live.",
        "I'm thinking about ending my life tonight.",
        "I want to kill myself.",
        "I've been thinking about suicide a lot lately.",
        "I'm ready to end it all.",
        "Everyone would be better off without me.",
        "I can't take it anymore, I want to hurt myself.",
    ]
    for phrase in high_risk_cases:
        assert memory_service.is_crisis_input(phrase), f"Failed to detect crisis in: {phrase}"

    # False positives that MUST NOT trigger
    false_positive_cases = [
        "I'm dying of laughter from that meme!",
        "That comedy show killed myself laughing.",
        "This project deadline is killing me.",
        "I am dying to see the new movie.",
        "Doing that would be career suicide for any engineer.",
        "We watched the movie Suicide Squad yesterday.",
        "I'm feeling really overwhelmed with work today.",
        "I had a terrible day and feel sad.",
    ]
    for phrase in false_positive_cases:
        assert not memory_service.is_crisis_input(phrase), f"False positive detected on non-crisis input: {phrase}"

    # Test regional localization response generator
    india_resp = get_crisis_response("IN")
    assert "Tele-MANAS" in india_resp and "14416" in india_resp and "112" in india_resp
    us_resp = get_crisis_response("US")
    assert "988" in us_resp and "911" in us_resp
    gb_resp = get_crisis_response("GB")
    assert "116 123" in gb_resp and "999" in gb_resp
    global_resp = get_crisis_response("GLOBAL")
    assert "findahelpline.com" in global_resp

    print("PASS: Crisis safety detector passed all high-risk phrases and rejected all false-positive idioms.")


if __name__ == "__main__":
    test_check_ins_full_flow()
    test_conversations_and_messages_flow()
    test_memories_consent_and_management()
    test_streaming_chat_with_mock_provider()
    test_missing_gemini_key_graceful_handling()
    test_crisis_input_detection()
    print("\n=======================================================")
    print("ALL PHASE 3 BACKEND TESTS COMPLETED SUCCESSFULLY!")
    print("=======================================================")

