"""
Solace AI - Live HTTP Authentication & Isolation Verification Script
Tests real Supabase JWT tokens against the FastAPI HTTP endpoints.
"""
import os
import sys
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.supabase_client import get_supabase_client

client = TestClient(app)


def test_live_http_auth():
    print("==================================================================")
    print("SOLACE AI - LIVE SUPABASE HTTP AUTH & ISOLATION VERIFICATION")
    print("==================================================================")

    supa = get_supabase_client()
    uid_a = str(uuid.uuid4())
    uid_b = str(uuid.uuid4())
    email_a = f"http_test_a_{uid_a[:8]}@solace.internal"
    email_b = f"http_test_b_{uid_b[:8]}@solace.internal"
    password = "TestPassword999!!$$"

    print("\n1. Provisioning Live Users in Supabase Auth:")
    res_a = supa.auth.admin.create_user({
        "email": email_a,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": "HTTP Tester Alpha"}
    })
    real_id_a = res_a.user.id
    print(f"   ✓ Created User A: {email_a} (ID: {real_id_a})")

    res_b = supa.auth.admin.create_user({
        "email": email_b,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": "HTTP Tester Beta"}
    })
    real_id_b = res_b.user.id
    print(f"   ✓ Created User B: {email_b} (ID: {real_id_b})")

    try:
        # Step 2: Sign in with separate client to acquire real Supabase JWTs without mutating service client
        print("\n2. Signing in to acquire real Supabase Auth JWTs:")
        from supabase import create_client
        auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        session_a = auth_client.auth.sign_in_with_password({"email": email_a, "password": password})
        token_a = session_a.session.access_token
        assert token_a, "Failed to retrieve access token for User A"
        print(f"   ✓ User A access token acquired (length: {len(token_a)})")

        auth_client_b = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        session_b = auth_client_b.auth.sign_in_with_password({"email": email_b, "password": password})
        token_b = session_b.session.access_token
        assert token_b, "Failed to retrieve access token for User B"
        print(f"   ✓ User B access token acquired (length: {len(token_b)})")

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Step 3: Test Profile API with real tokens
        print("\n3. Testing Profile Endpoints via FastAPI HTTP:")
        p_res_a = client.get("/api/v1/profile/me", headers=headers_a)
        assert p_res_a.status_code == 200, f"Expected 200, got {p_res_a.status_code}: {p_res_a.text}"
        assert p_res_a.json()["id"] == real_id_a
        print(f"   ✓ FastAPI /profile/me authenticated User A: {p_res_a.json()['display_name']}")

        p_res_b = client.get("/api/v1/profile/me", headers=headers_b)
        assert p_res_b.status_code == 200
        assert p_res_b.json()["id"] == real_id_b
        print(f"   ✓ FastAPI /profile/me authenticated User B: {p_res_b.json()['display_name']}")

        # Step 4: Test Mood Check-in Isolation
        print("\n4. Testing Mood Check-in HTTP Isolation:")
        post_ci = client.post(
            "/api/v1/check-ins",
            json={"mood": "peaceful", "intensity": 5, "note": "Live HTTP test check-in"},
            headers=headers_a
        )
        assert post_ci.status_code == 201
        ci_id = post_ci.json()["id"]
        print(f"   ✓ User A created check-in: {ci_id}")

        # User B queries their history
        hist_b = client.get("/api/v1/check-ins/history", headers=headers_b)
        assert hist_b.status_code == 200
        b_ids = [item["id"] for item in hist_b.json().get("items", [])]
        assert ci_id not in b_ids
        print("   ✓ User A's check-in is invisible to User B.")

        # Step 5: Test Conversation Session & Messages Isolation
        print("\n5. Testing Conversation Session HTTP Isolation:")
        post_sess = client.post("/api/v1/conversations", json={"title": "Alpha Private Session"}, headers=headers_a)
        assert post_sess.status_code == 201
        sess_id = post_sess.json()["id"]
        print(f"   ✓ User A created conversation session: {sess_id}")

        # User B attempts to access User A's session
        leak_sess = client.get(f"/api/v1/conversations/{sess_id}", headers=headers_b)
        assert leak_sess.status_code == 404
        print("   ✓ User B blocked with 404 from accessing User A's session.")

        # Step 6: Test Emotional Memory HTTP Consent & Isolation
        print("\n6. Testing Emotional Memory HTTP Isolation:")
        post_mem = client.post(
            "/api/v1/memories",
            json={"memory_text": "Sensitive context only for Alpha", "category": "important_context"},
            headers=headers_a
        )
        assert post_mem.status_code == 201
        mem_id = post_mem.json()["id"]
        print(f"   ✓ User A created memory: {mem_id}")

        # User B lists memories -> should be 0
        b_mems = client.get("/api/v1/memories", headers=headers_b)
        assert b_mems.status_code == 200
        assert len(b_mems.json().get("items", [])) == 0
        print("   ✓ User B memories list is empty (strict isolation).")

        # User B tries to delete User A's memory
        tamper_del = client.delete(f"/api/v1/memories/{mem_id}", headers=headers_b)
        assert tamper_del.status_code == 404
        print("   ✓ User B blocked with 404 from deleting User A's memory.")

        # User A successfully deletes own memory
        del_own = client.delete(f"/api/v1/memories/{mem_id}", headers=headers_a)
        assert del_own.status_code == 200
        print("   ✓ User A successfully deleted own memory.")

        print("\n==================================================================")
        print("✓ LIVE HTTP AUTH & USER ISOLATION VERIFICATION 100% SUCCESSFUL!")
        print("==================================================================")
        return True

    finally:
        print("\n7. Cleaning up test accounts from Supabase Auth:")
        try:
            supa.auth.admin.delete_user(real_id_a)
            supa.auth.admin.delete_user(real_id_b)
            print("   ✓ Cleanup complete.")
        except Exception as e:
            print(f"   ⚠️ Cleanup error: {e}")


if __name__ == "__main__":
    ok = test_live_http_auth()
    sys.exit(0 if ok else 1)
