"""
Solace AI - Full E2E Live Gemini SSE Streaming & Database Integration Test
Tests SSE streaming with live Supabase authentication, memory injection, and real Gemini response tokens.
"""
import os
import sys
import uuid
import json

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.supabase_client import get_supabase_client
from supabase import create_client

client = TestClient(app)


def test_live_chat_stream_e2e():
    print("==================================================================")
    print("SOLACE AI - FULL E2E LIVE GEMINI SSE STREAMING & DB PERSISTENCE")
    print("==================================================================")

    supa_admin = get_supabase_client()
    uid = str(uuid.uuid4())
    email = f"stream_test_{uid[:8]}@solace.internal"
    password = "LiveStreamPassword123!!"

    # 1. Create live user
    print("\n[Step 1] Creating Live User in Supabase Auth:")
    res_user = supa_admin.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": "Maya Lin"}
    })
    real_user_id = res_user.user.id
    print(f"   ✓ Created user {email} (ID: {real_user_id})")

    try:
        # 2. Sign in to obtain live JWT
        print("\n[Step 2] Authenticating with Supabase Auth to obtain Live JWT:")
        auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        session = auth_client.auth.sign_in_with_password({"email": email, "password": password})
        token = session.session.access_token
        headers = {"Authorization": f"Bearer {token}"}
        print("   ✓ Live JWT token acquired.")

        # 3. Create an approved emotional memory on the live database
        print("\n[Step 3] Adding an Approved Emotional Memory on Live Supabase:")
        mem_res = client.post(
            "/api/v1/memories",
            json={
                "memory_text": "Takes slow sips of chamomile tea and does 4-7-8 breathing when stressed.",
                "category": "coping_strategies",
                "source": "conversation"
            },
            headers=headers
        )
        assert mem_res.status_code == 201
        print("   ✓ Memory created & stored in live Supabase 'user_memories'.")

        # 4. Create a conversation session
        print("\n[Step 4] Creating Conversation Session on Live Supabase:")
        sess_res = client.post("/api/v1/conversations", json={"title": "Evening Unwind"}, headers=headers)
        assert sess_res.status_code == 201
        session_id = sess_res.json()["id"]
        print(f"   ✓ Conversation session initialized: {session_id}")

        # 5. Open SSE stream and receive real Gemini response
        print("\n[Step 5] Streaming Response from Google Gemini with Live Context:")
        chat_payload = {
            "session_id": session_id,
            "content": "I had a very intense argument today and I feel tense. What should I do right now?",
            "include_memories": True
        }

        events_received = []
        collected_tokens = []

        with client.stream("POST", "/api/v1/chat/stream", json=chat_payload, headers=headers) as response:
            assert response.status_code == 200, f"Expected 200 SSE, got {response.status_code}"
            assert "text/event-stream" in response.headers.get("content-type", "")

            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("data:"):
                    data_str = line.replace("data:", "").strip()
                    try:
                        data_json = json.loads(data_str)
                        ev = data_json.get("event")
                        if ev:
                            events_received.append(ev)
                        if ev == "token":
                            t = data_json.get("token", "")
                            collected_tokens.append(t)
                            print(t, end="", flush=True)
                        elif ev == "memory_suggestion":
                            print(f"\n   [Memory Suggestion Event]: {data_json.get('memory_text')}")
                    except Exception:
                        pass

        print()
        assert "message_start" in events_received, "Missing message_start event"
        assert "token" in events_received, "Missing token events"
        assert "message_complete" in events_received, "Missing message_complete event"
        assert len(collected_tokens) > 0, "No tokens received from Gemini"
        print(f"\n   ✓ SSE stream completed! Total tokens received: {len(collected_tokens)}")

        # 6. Verify messages were persisted to the live database
        print("\n[Step 6] Verifying Chat History in Live Supabase Database:")
        msgs_res = client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
        assert msgs_res.status_code == 200
        saved_messages = msgs_res.json()
        assert len(saved_messages) >= 2, f"Expected at least 2 messages, found {len(saved_messages)}"
        print(f"   ✓ Confirmed {len(saved_messages)} messages saved in live 'conversation_messages' table:")
        for m in saved_messages:
            preview = m['content'][:60] + "..." if len(m['content']) > 60 else m['content']
            print(f"     • [{m['role'].upper()}]: \"{preview}\"")

        print("\n==================================================================")
        print("✓ FULL E2E LIVE GEMINI STREAMING & PERSISTENCE VERIFIED 100%!")
        print("==================================================================")
        return True

    finally:
        print("\n[Step 7] Cleaning up test account from Supabase Auth:")
        try:
            supa_admin.auth.admin.delete_user(real_user_id)
            print("   ✓ Test account cleaned up successfully.")
        except Exception as e:
            print(f"   ⚠️ Cleanup warning: {e}")


if __name__ == "__main__":
    ok = test_live_chat_stream_e2e()
    sys.exit(0 if ok else 1)
