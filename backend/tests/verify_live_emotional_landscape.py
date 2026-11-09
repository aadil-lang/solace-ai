import os
import sys
import uuid
from datetime import datetime, timezone
from supabase import create_client

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings


def run_live_verification():
    print("==================================================================")
    print("SOLACE AI — LIVE SUPABASE EMOTIONAL LANDSCAPE & RLS VERIFICATION")
    print("==================================================================\n")

    url = settings.SUPABASE_URL
    anon_key = settings.SUPABASE_KEY
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY

    assert url, "SUPABASE_URL must be configured"
    assert anon_key, "SUPABASE_KEY (anon key) must be configured"
    assert service_role_key, "SUPABASE_SERVICE_ROLE_KEY required for administrative test setup"

    admin_client = create_client(url, service_role_key)

    # 1. Check check_ins table and is_meaningful column
    print("[1/8] Verifying 'public.check_ins' and 'is_meaningful' column...")
    try:
        res = admin_client.table("check_ins").select("id, is_meaningful").limit(1).execute()
        print(f"✓ Column 'public.check_ins.is_meaningful' exists and is queryable.")
    except Exception as e:
        print(f"✗ 'is_meaningful' column or 'public.check_ins' NOT found in schema: {e}")
        return False

    # 2. Check landscape_reflections table
    print("\n[2/8] Verifying table 'public.landscape_reflections'...")
    try:
        res_ref = admin_client.table("landscape_reflections").select("id").limit(1).execute()
        print(f"✓ Table 'public.landscape_reflections' exists and is queryable.")
    except Exception as e:
        print(f"✗ Table 'public.landscape_reflections' NOT found in schema: {e}")
        return False

    # 3. Setup Authenticated Users (User A and User B)
    print("\n[3/8] Preparing distinct authenticated test users (User A & User B)...")
    user_a_email = "test_rls_landscape_a@solace.internal"
    user_b_email = "test_rls_landscape_b@solace.internal"
    test_password = "SolaceTestLandscape123!"

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

    # 4. Authenticate as User A and User B via Anon Client (Strict RLS)
    print("\n[4/8] Authenticating User A and User B with standard anon keys (RLS active)...")
    client_a = create_client(url, anon_key)
    session_a = client_a.auth.sign_in_with_password({"email": user_a_email, "password": test_password})
    assert session_a.user.id == user_a_id, "User A sign-in verification failed"

    client_b = create_client(url, anon_key)
    session_b = client_b.auth.sign_in_with_password({"email": user_b_email, "password": test_password})
    assert session_b.user.id == user_b_id, "User B sign-in verification failed"
    print("✓ Both users authenticated with standard JWTs.")

    check_in_id = str(uuid.uuid4())
    reflection_id = str(uuid.uuid4())

    try:
        # 5. User A creates check-in & updates is_meaningful
        print("\n[5/8] Testing User A check-in creation and legitimate is_meaningful update...")
        now_iso = datetime.now(timezone.utc).isoformat()
        ci_payload = {
            "id": check_in_id,
            "user_id": user_a_id,
            "mood": "peaceful",
            "intensity": 3,
            "note": "Morning stillness",
            "is_meaningful": False,
            "created_at": now_iso,
        }
        res_ins = client_a.table("check_ins").insert(ci_payload).execute()
        assert res_ins.data and len(res_ins.data) == 1, "User A check-in insert failed"
        print("✓ User A successfully inserted check-in with is_meaningful=False.")

        # Update ONLY is_meaningful
        res_upd = client_a.table("check_ins").update({"is_meaningful": True}).eq("id", check_in_id).execute()
        assert res_upd.data and len(res_upd.data) == 1, "User A is_meaningful update failed"
        assert res_upd.data[0]["is_meaningful"] is True, "is_meaningful did not update to True"
        print("✓ User A successfully updated is_meaningful to True.")

        # 6. Database Trigger Mutation Guard: Attempting to modify mood / intensity / note
        print("\n[6/8] Testing database trigger mutation guard on protected columns...")
        mutation_blocked = False
        try:
            client_a.table("check_ins").update({"mood": "anxious"}).eq("id", check_in_id).execute()
        except Exception as e:
            mutation_blocked = True
            print(f"✓ Mutation of 'mood' was correctly rejected by database trigger: {e}")

        assert mutation_blocked, "Database trigger failed to block mutation of protected column 'mood'!"

        # 7. Cross-User Isolation (User B cannot read, update, or delete User A's check-in)
        print("\n[7/8] Testing cross-user RLS isolation (User B accessing User A)...")
        # Read
        b_read = client_b.table("check_ins").select("*").eq("id", check_in_id).execute()
        assert len(b_read.data) == 0, "SECURITY VIOLATION: User B read User A's check-in"
        print("✓ User B cannot read User A's check-in (0 rows returned).")

        # Update
        b_upd = client_b.table("check_ins").update({"is_meaningful": False}).eq("id", check_in_id).execute()
        assert len(b_upd.data) == 0, "SECURITY VIOLATION: User B updated User A's check-in"
        print("✓ User B cannot update User A's check-in (0 rows modified).")

        # Delete
        b_del = client_b.table("check_ins").delete().eq("id", check_in_id).execute()
        assert len(b_del.data) == 0, "SECURITY VIOLATION: User B deleted User A's check-in"
        print("✓ User B cannot delete User A's check-in (0 rows deleted).")

        # 8. Landscape Reflections RLS Verification
        print("\n[8/8] Testing landscape reflections RLS isolation...")
        ref_payload = {
            "id": reflection_id,
            "user_id": user_a_id,
            "timeframe": "7d",
            "reflection": "A calm, grounded week.",
            "dominant_mood": "peaceful",
            "created_at": now_iso,
        }
        res_ref_ins = client_a.table("landscape_reflections").insert(ref_payload).execute()
        assert res_ref_ins.data and len(res_ref_ins.data) == 1, "User A reflection insert failed"
        print("✓ User A inserted reflection.")

        # User B cannot read User A's reflection
        b_ref_read = client_b.table("landscape_reflections").select("*").eq("id", reflection_id).execute()
        assert len(b_ref_read.data) == 0, "SECURITY VIOLATION: User B read User A's reflection"
        print("✓ User B cannot read User A's reflection (0 rows returned).")

        # User A can read own reflection
        a_ref_read = client_a.table("landscape_reflections").select("*").eq("id", reflection_id).execute()
        assert len(a_ref_read.data) == 1, "User A failed to read own reflection"
        print("✓ User A can read own reflection.")

        print("\n==================================================================")
        print("ALL LIVE EMOTIONAL LANDSCAPE RLS & TRIGGER CHECKS PASSED!")
        print("==================================================================")
        return True

    finally:
        # Clean up test rows
        try:
            admin_client.table("check_ins").delete().eq("id", check_in_id).execute()
            admin_client.table("landscape_reflections").delete().eq("id", reflection_id).execute()
            print("✓ Cleaned up test check-in and reflection records.")
        except Exception as e:
            print(f"Warning during test cleanup: {e}")


if __name__ == "__main__":
    success = run_live_verification()
    sys.exit(0 if success else 1)

