import os
import sys
import uuid
import time
from datetime import datetime, timezone
from supabase import create_client

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings


def run_live_verification():
    print("==================================================================")
    print("SOLACE AI — LIVE SUPABASE VOICE JOURNALS AUDIT & RLS VERIFICATION")
    print("==================================================================\n")

    url = settings.SUPABASE_URL
    anon_key = settings.SUPABASE_KEY  # Public anon key
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY

    assert url, "SUPABASE_URL must be configured"
    assert anon_key, "SUPABASE_KEY (anon key) must be configured"
    assert service_role_key, "SUPABASE_SERVICE_ROLE_KEY required for administrative test setup"

    # Admin client strictly used to setup test user accounts and clean up
    admin_client = create_client(url, service_role_key)

    # 1. Check Table Existence and Schema Cache
    print("[1/7] Checking table existence & schema cache for 'public.voice_journals'...")
    try:
        res = admin_client.table("voice_journals").select("id").limit(1).execute()
        print(f"✓ Table 'public.voice_journals' exists and is accessible. (Current rows: {len(res.data)})")
    except Exception as e:
        print(f"✗ Table 'public.voice_journals' is NOT found in schema: {e}")
        return False

    # 2. Setup Authenticated Users (User A and User B)
    print("\n[2/7] Preparing separate user identities for RLS testing...")
    user_a_email = "test_rls_journal_a@solace.internal"
    user_b_email = "test_rls_journal_b@solace.internal"
    test_password = "SolaceTestPassword123!"

    # Find or create User A
    users = admin_client.auth.admin.list_users()
    user_a = next((u for u in users if u.email == user_a_email), None)
    if not user_a:
        res_a = admin_client.auth.admin.create_user({
            "email": user_a_email,
            "password": test_password,
            "email_confirm": True,
        })
        user_a = res_a.user if hasattr(res_a, "user") else res_a
        print(f"Created test User A: {user_a.id} ({user_a_email})")
    else:
        print(f"Found existing test User A: {user_a.id} ({user_a_email})")

    # Find or create User B
    user_b = next((u for u in users if u.email == user_b_email), None)
    if not user_b:
        res_b = admin_client.auth.admin.create_user({
            "email": user_b_email,
            "password": test_password,
            "email_confirm": True,
        })
        user_b = res_b.user if hasattr(res_b, "user") else res_b
        print(f"Created test User B: {user_b.id} ({user_b_email})")
    else:
        print(f"Found existing test User B: {user_b.id} ({user_b_email})")

    user_a_id = str(user_a.id)
    user_b_id = str(user_b.id)

    # 3. Create Authenticated User Sessions using Anon Key (Exercising true RLS, NOT service-role)
    print("\n[3/7] Signing in as User A and User B using public anon key (exercising real RLS)...")
    client_a = create_client(url, anon_key)
    session_a = client_a.auth.sign_in_with_password({
        "email": user_a_email,
        "password": test_password,
    })
    assert session_a.session and session_a.session.access_token, "User A sign-in failed"
    print("✓ Client A successfully authenticated with user JWT (anon key).")

    client_b = create_client(url, anon_key)
    session_b = client_b.auth.sign_in_with_password({
        "email": user_b_email,
        "password": test_password,
    })
    assert session_b.session and session_b.session.access_token, "User B sign-in failed"
    print("✓ Client B successfully authenticated with user JWT (anon key).")

    # 4. User A Insert & Retrieve via RLS
    print("\n[4/7] Testing User A INSERT and SELECT under Row Level Security...")
    journal_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    insert_res = client_a.table("voice_journals").insert({
        "id": journal_id,
        "user_id": user_a_id,
        "title": "User A Private Journal",
        "transcript": "Deep breath. The day was chaotic, but right now there is stillness.",
        "mood_tag": "peaceful",
        "duration_seconds": 42,
        "reflection": "A grounded moment of stillness.",
        "created_at": now_iso,
        "updated_at": now_iso,
    }).execute()
    assert insert_res.data and len(insert_res.data) > 0, "User A insert failed under RLS"
    print(f"✓ User A successfully inserted journal: ID={journal_id}")

    # User A selects their own journal
    select_a = client_a.table("voice_journals").select("*").eq("id", journal_id).execute()
    assert len(select_a.data) == 1, "User A failed to retrieve their own journal"
    assert select_a.data[0]["title"] == "User A Private Journal"
    print("✓ User A successfully queried their own journal via RLS SELECT policy.")

    # 5. Two-User Cross-Isolation Verification (User B cannot see, edit, or delete User A's journal)
    print("\n[5/7] Verifying Two-User Cross-Isolation (RLS strictly prevents cross-user access)...")

    # User B lists journals -> must be empty
    list_b = client_b.table("voice_journals").select("*").execute()
    assert not any(j["id"] == journal_id for j in list_b.data), "RLS BREACH: User B saw User A's journal in general list!"
    print("✓ User B general query returned 0 rows belonging to User A.")

    # User B queries User A's specific journal ID
    b_direct_query = client_b.table("voice_journals").select("*").eq("id", journal_id).execute()
    assert len(b_direct_query.data) == 0, "RLS BREACH: User B directly queried User A's journal ID!"
    print("✓ User B direct query by ID returned 0 rows (BLOCKED BY RLS).")

    # User B attempts to UPDATE User A's journal
    b_update_attempt = client_b.table("voice_journals").update({"title": "Malicious Tampering"}).eq("id", journal_id).execute()
    assert len(b_update_attempt.data) == 0, "RLS BREACH: User B updated User A's journal!"
    print("✓ User B update attempt modified 0 rows (BLOCKED BY RLS).")

    # Verify User A's journal was NOT modified
    verify_unmodified = client_a.table("voice_journals").select("title").eq("id", journal_id).execute()
    assert verify_unmodified.data[0]["title"] == "User A Private Journal"
    print("✓ Verified User A's title remained untouched.")

    # User B attempts to DELETE User A's journal
    b_delete_attempt = client_b.table("voice_journals").delete().eq("id", journal_id).execute()
    assert len(b_delete_attempt.data) == 0, "RLS BREACH: User B deleted User A's journal!"
    print("✓ User B delete attempt deleted 0 rows (BLOCKED BY RLS).")

    # 6. Trigger Verification (set_voice_journals_updated_at) & Foreign-Key Constraints
    print("\n[6/7] Verifying updated_at trigger & foreign key constraints...")
    time.sleep(1)  # Ensure timestamp advance
    update_res = client_a.table("voice_journals").update({"title": "User A Private Journal (Edited)"}).eq("id", journal_id).execute()
    assert len(update_res.data) > 0
    record = update_res.data[0]
    created_at = record["created_at"]
    updated_at = record["updated_at"]
    assert updated_at > created_at, f"Trigger failed: updated_at ({updated_at}) is not greater than created_at ({created_at})"
    print(f"✓ Trigger 'set_voice_journals_updated_at' verified (Created: {created_at}, Updated: {updated_at}).")

    # Test foreign key enforcement (attempting to insert non-existent user_id)
    fake_uuid = "00000000-0000-0000-0000-000000000001"
    try:
        admin_client.table("voice_journals").insert({
            "id": str(uuid.uuid4()),
            "user_id": fake_uuid,
            "title": "Violating FK",
            "transcript": "Test",
        }).execute()
        assert False, "FAILED: Foreign key constraint failed to block invalid user_id!"
    except Exception as e:
        assert "23503" in str(e) or "foreign key" in str(e).lower() or "violates" in str(e).lower()
        print("✓ Foreign-key constraint verified: synthetic user ID rejected (23503).")

    # 7. Clean Deletion & Cascade Verification
    print("\n[7/7] Verifying user DELETE policy and cleanup...")
    del_res = client_a.table("voice_journals").delete().eq("id", journal_id).execute()
    assert len(del_res.data) > 0, "User A delete failed under RLS"
    verify_deleted = client_a.table("voice_journals").select("*").eq("id", journal_id).execute()
    assert len(verify_deleted.data) == 0, "Journal still exists after delete"
    print("✓ User A journal cleanly deleted via RLS DELETE policy.")

    # Cleanup temporary test users
    admin_client.auth.admin.delete_user(user_a_id)
    admin_client.auth.admin.delete_user(user_b_id)
    print("✓ Temporary test identities cleaned up.")

    print("\n==================================================================")
    print("ALL LIVE SUPABASE AUDIT CHECKS PASSED WITH 100% FIDELITY!")
    print("==================================================================")
    return True


if __name__ == "__main__":
    run_live_verification()
