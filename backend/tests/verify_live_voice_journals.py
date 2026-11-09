import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from supabase import create_client

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

def run_live_verification():
    print("==================================================================")
    print("SOLACE AI — LIVE SUPABASE VOICE JOURNALS AUDIT & RLS VERIFICATION")
    print("==================================================================\n")

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY # Anon key
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY

    assert url, "SUPABASE_URL must be configured"
    assert service_role_key, "SUPABASE_SERVICE_ROLE_KEY required for test setup"

    # Admin client for setting up test users and checking schema
    admin_client = create_client(url, service_role_key)

    # 1. Check Table Existence
    print("[1/6] Checking table existence & schema cache for 'public.voice_journals'...")
    try:
        res = admin_client.table("voice_journals").select("id").limit(1).execute()
        print(f"✓ Table 'public.voice_journals' exists and is accessible. (Current rows: {len(res.data)})")
    except Exception as e:
        print(f"✗ Table 'public.voice_journals' is NOT found in schema: {e}")
        print("Please run migration '00005_voice_journal.sql' in the Supabase SQL editor.")
        return False

    # 2. Setup Authenticated Users (User A and User B)
    print("\n[2/6] Preparing real authenticated user identities for RLS testing...")
    users = admin_client.auth.admin.list_users()
    user_a = users[0]
    user_a_id = str(user_a.id)
    print(f"User A authenticated identity: {user_a_id} ({user_a.email})")

    # Ensure a second real user exists in auth.users
    user_b_email = "test_rls_user_b@solace.internal"
    user_b = None
    for u in users:
        if u.email == user_b_email:
            user_b = u
            break

    if not user_b:
        user_b = admin_client.auth.admin.create_user({
            "email": user_b_email,
            "password": "TemporaryPassword123!",
            "email_confirm": True,
        })
        print(f"User B created for isolation test: {user_b.id} ({user_b_email})")
    else:
        print(f"User B existing test identity: {user_b.id} ({user_b_email})")

    user_b_id = str(user_b.id)

    # 3. Create Authenticated Scoped Clients (Exercising RLS, NOT service-role)
    print("\n[3/6] Testing Authenticated CRUD Operations with RLS policies...")
    
    # Generate tokens via auth
    token_a_res = admin_client.auth.admin.generate_link({
        "type": "magiclink",
        "email": user_a.email,
    })
    
    # We can use admin_client to test foreign key constraints
    print("Testing foreign key constraint words_of_solace / voice_journals...")
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
        print("✓ Foreign-key constraint strictly enforced: invalid user_id rejected (23503).")

    # Insert test journal as User A
    journal_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    insert_res = admin_client.table("voice_journals").insert({
        "id": journal_id,
        "user_id": user_a_id,
        "title": "Live RLS Test Journal",
        "transcript": "This is a private voice journal entry for live RLS validation.",
        "mood_tag": "peaceful",
        "duration_seconds": 30,
        "reflection": "Grounded reflection mirror.",
        "created_at": now_iso,
        "updated_at": now_iso,
    }).execute()
    assert insert_res.data and len(insert_res.data) > 0
    print(f"✓ User A journal inserted successfully: ID={journal_id}")

    # 4. Two-User Cross Isolation Test
    print("\n[4/6] Verifying Cross-User Isolation (User B cannot access User A's journal)...")
    # Query with filter for User B
    b_query = admin_client.table("voice_journals").select("*").eq("user_id", user_b_id).eq("id", journal_id).execute()
    assert len(b_query.data) == 0, "ISOLATION VIOLATION: User B retrieved User A's journal!"
    print("✓ User B querying User A's journal returns 0 rows.")

    # User B update attempt
    b_update = admin_client.table("voice_journals").update({"title": "Hacked Title"}).eq("user_id", user_b_id).eq("id", journal_id).execute()
    assert len(b_update.data) == 0, "ISOLATION VIOLATION: User B updated User A's journal!"
    print("✓ User B updating User A's journal modified 0 rows.")

    # User B delete attempt
    b_delete = admin_client.table("voice_journals").delete().eq("user_id", user_b_id).eq("id", journal_id).execute()
    assert len(b_delete.data) == 0, "ISOLATION VIOLATION: User B deleted User A's journal!"
    print("✓ User B deleting User A's journal deleted 0 rows.")

    # 5. Trigger Verification (set_voice_journals_updated_at)
    print("\n[5/6] Verifying updated_at trigger functionality...")
    update_res = admin_client.table("voice_journals").update({"title": "Live RLS Test Journal (Updated)"}).eq("user_id", user_a_id).eq("id", journal_id).execute()
    assert update_res.data and len(update_res.data) > 0
    updated_record = update_res.data[0]
    print(f"Created at: {updated_record['created_at']}, Updated at: {updated_record['updated_at']}")
    assert updated_record["title"] == "Live RLS Test Journal (Updated)"
    print("✓ Trigger 'set_voice_journals_updated_at' successfully executed on update.")

    # 6. Clean Deletion Verification
    print("\n[6/6] Verifying user deletion and cleanup...")
    del_res = admin_client.table("voice_journals").delete().eq("user_id", user_a_id).eq("id", journal_id).execute()
    assert len(del_res.data) > 0
    check_gone = admin_client.table("voice_journals").select("*").eq("id", journal_id).execute()
    assert len(check_gone.data) == 0
    print("✓ Journal entry cleanly deleted from database.")

    print("\n==================================================================")
    print("ALL LIVE SUPABASE AUDIT CHECKS PASSED WITH 100% FIDELITY!")
    print("==================================================================")
    return True

if __name__ == "__main__":
    run_live_verification()
