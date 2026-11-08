"""
Solace AI - Live Supabase User Isolation & Ownership Test Suite
Verifies strict RLS policy enforcement and ownership isolation between accounts on live Supabase.
"""
import os
import sys
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_live_supabase_isolation(token_a: str, token_b: str, user_a_id: str, user_b_id: str):
    print("==================================================================")
    print("SOLACE AI - LIVE SUPABASE RLS & USER ISOLATION VERIFICATION")
    print("==================================================================")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Profile Isolation
    print("\n[1/5] Testing Profile Isolation:")
    prof_a = client.get("/api/v1/profile/me", headers=headers_a)
    assert prof_a.status_code == 200
    assert prof_a.json()["id"] == user_a_id

    prof_b = client.get("/api/v1/profile/me", headers=headers_b)
    assert prof_b.status_code == 200
    assert prof_b.json()["id"] == user_b_id
    print("   ✓ User profiles strictly isolated per JWT.")

    # 2. Mood Check-ins Isolation
    print("\n[2/5] Testing Mood Check-ins Isolation:")
    # Account A creates check-in
    ci_res = client.post(
        "/api/v1/check-ins",
        json={"mood": "reflective", "intensity": 3, "note": "Account A private note"},
        headers=headers_a
    )
    assert ci_res.status_code == 201
    check_in_a_id = ci_res.json()["id"]

    # Account B attempts to fetch Account A's check-in by ID
    leak_ci = client.get(f"/api/v1/check-ins/{check_in_a_id}", headers=headers_b)
    assert leak_ci.status_code == 404, "Account B must receive 404 when querying Account A's check-in"

    # Account B queries history -> must not see Account A's check-in
    history_b = client.get("/api/v1/check-ins/history", headers=headers_b)
    assert history_b.status_code == 200
    b_items = [c["id"] for c in history_b.json().get("items", [])]
    assert check_in_a_id not in b_items, "Account A check-in leaked to Account B history"
    print("   ✓ Mood check-ins completely isolated.")

    # 3. Conversation Sessions & Messages Isolation
    print("\n[3/5] Testing Conversation Sessions & Messages Isolation:")
    # Account A creates session
    sess_res = client.post("/api/v1/conversations", json={"title": "Session A Private"}, headers=headers_a)
    assert sess_res.status_code == 201
    session_a_id = sess_res.json()["id"]

    # Account B attempts to read Account A's session
    leak_sess = client.get(f"/api/v1/conversations/{session_a_id}", headers=headers_b)
    assert leak_sess.status_code == 404, "Account B must receive 404 when accessing Account A's session"

    # Account B attempts to read Account A's session messages
    leak_msgs = client.get(f"/api/v1/conversations/{session_a_id}/messages", headers=headers_b)
    assert leak_msgs.status_code == 404
    print("   ✓ Conversation sessions & messages completely isolated.")

    # 4. Emotional Memories Isolation & Consent
    print("\n[4/5] Testing Emotional Memory Isolation & Deletion Protection:")
    # Account A creates approved memory
    mem_res = client.post(
        "/api/v1/memories",
        json={"memory_text": "Account A private memory", "category": "preferences"},
        headers=headers_a
    )
    assert mem_res.status_code == 201
    memory_a_id = mem_res.json()["id"]

    # Account B tries to list memories -> must not contain Account A's memory
    b_memories = client.get("/api/v1/memories", headers=headers_b)
    assert b_memories.status_code == 200
    b_mem_ids = [m["id"] for m in b_memories.json().get("items", [])]
    assert memory_a_id not in b_mem_ids, "Account A memory leaked to Account B"

    # Account B tries to patch / disable Account A's memory
    tamper_res = client.patch(f"/api/v1/memories/{memory_a_id}", json={"is_active": False}, headers=headers_b)
    assert tamper_res.status_code == 404

    # Account B tries to delete Account A's memory
    del_tamper = client.delete(f"/api/v1/memories/{memory_a_id}", headers=headers_b)
    assert del_tamper.status_code == 404
    print("   ✓ Emotional memories protected against cross-user tampering.")

    # 5. Clean Up Account A resources
    client.delete(f"/api/v1/memories/{memory_a_id}", headers=headers_a)
    client.delete(f"/api/v1/check-ins/{check_in_a_id}", headers=headers_a)
    client.delete(f"/api/v1/conversations/{session_a_id}", headers=headers_a)

    print("\n==================================================================")
    print("✓ ALL CROSS-USER ISOLATION & RLS ENFORCEMENT CHECKS PASSED!")
    print("==================================================================")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python test_live_supabase_user_isolation.py <token_a> <token_b> <user_a_id> <user_b_id>")
        sys.exit(0)
    test_live_supabase_isolation(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])

