"""
Solace AI - End-to-End Live Supabase Verification Script
Performs full authentication, data persistence, and cross-user isolation against the live Supabase project.
"""
import os
import sys
import uuid
import asyncio

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.supabase_client import get_supabase_client
from app.repositories.profile_repository import ProfileRepository
from app.repositories.check_in_repository import CheckInRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.memory_repository import MemoryRepository

from app.schemas.profile import ProfileUpdate
from app.schemas.check_in import CheckInCreate
from app.schemas.conversation import ConversationMessageCreate
from app.schemas.memory import MemoryCreate


async def run_live_supabase_e2e():
    print("==================================================================")
    print("SOLACE AI - FULL END-TO-END LIVE SUPABASE VERIFICATION")
    print("==================================================================")

    client = get_supabase_client()
    print(f"Supabase Client Target: {settings.SUPABASE_URL}")

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())
    email_a = f"solace_test_a_{user_a_id[:8]}@solace.internal"
    email_b = f"solace_test_b_{user_b_id[:8]}@solace.internal"

    # Step 1: Create test users in auth.users via Supabase Admin API
    print("\n[Step 1] Creating Live Test Users in auth.users via Admin API:")
    user_a_res = client.auth.admin.create_user({
        "email": email_a,
        "password": "Password123!@#Test",
        "email_confirm": True,
        "user_metadata": {"full_name": "Test User Alpha"}
    })
    actual_user_a_id = user_a_res.user.id
    print(f"   ✓ User A created: {email_a} (ID: {actual_user_a_id})")

    user_b_res = client.auth.admin.create_user({
        "email": email_b,
        "password": "Password123!@#Test",
        "email_confirm": True,
        "user_metadata": {"full_name": "Test User Beta"}
    })
    actual_user_b_id = user_b_res.user.id
    print(f"   ✓ User B created: {email_b} (ID: {actual_user_b_id})")

    try:
        # Step 2: Test Profile Trigger & Profile Repository
        print("\n[Step 2] Testing Profile Trigger & Profile Repository:")
        prof_repo = ProfileRepository()
        prof_a = await prof_repo.get_by_user_id(actual_user_a_id, email=email_a)
        assert prof_a is not None, "Profile A was not found"
        print(f"   ✓ Trigger auto-created profile for User A (display_name: '{prof_a.display_name}')")

        # Update profile
        update_data = ProfileUpdate(
            preferred_name="Alpha",
            onboarding_completed=True,
            wellness_goals=["reduce_anxiety", "mindful_reflection"],
            interaction_style="gentle"
        )
        updated_prof = await prof_repo.update_by_user_id(actual_user_a_id, update_data)
        assert updated_prof.preferred_name == "Alpha"
        assert updated_prof.onboarding_completed is True
        print(f"   ✓ Profile updated and verified on live Supabase: {updated_prof.preferred_name}")

        # Step 3: Test Mood Check-in Repository
        print("\n[Step 3] Testing Check-In Persistence:")
        ci_repo = CheckInRepository()
        ci_create = CheckInCreate(
            mood="reflective",
            intensity=4,
            note="Evening reflection during live test."
        )
        ci_a = await ci_repo.create(user_id=actual_user_a_id, data=ci_create)
        assert ci_a is not None and ci_a.id is not None
        print(f"   ✓ Check-in created with ID: {ci_a.id} on live Supabase")

        history_a, total_a = await ci_repo.get_history(user_id=actual_user_a_id)
        assert total_a >= 1
        assert any(c.id == ci_a.id for c in history_a)
        print(f"   ✓ Check-in history retrieved: {total_a} record(s)")

        # Verify User B cannot see User A's check-in
        history_b, total_b = await ci_repo.get_history(user_id=actual_user_b_id)
        assert total_b == 0
        assert all(c.id != ci_a.id for c in history_b)
        print("   ✓ User B check-in history is strictly isolated from User A.")

        # Step 4: Test Conversation Sessions & Messages
        print("\n[Step 4] Testing Conversation Sessions & Messages:")
        conv_repo = ConversationRepository()
        session_a = await conv_repo.create_session(user_id=actual_user_a_id, title="Reflecting on Work")
        assert session_a is not None and session_a.id is not None
        print(f"   ✓ Conversation session created: {session_a.id} ('{session_a.title}')")

        msg1 = await conv_repo.create_message(
            session_id=session_a.id,
            user_id=actual_user_a_id,
            data=ConversationMessageCreate(role="user", content="I feel a bit overwhelmed today.")
        )
        msg2 = await conv_repo.create_message(
            session_id=session_a.id,
            user_id=actual_user_a_id,
            data=ConversationMessageCreate(role="assistant", content="I hear you. Take a slow breath. What feels heaviest right now?")
        )
        messages = await conv_repo.get_messages(user_id=actual_user_a_id, session_id=session_a.id)
        assert len(messages) == 2
        print(f"   ✓ Messages persisted and retrieved: {len(messages)} messages in session.")

        # Step 5: Test Emotional Memory Repository & Consent
        print("\n[Step 5] Testing Emotional Memory Consent & Isolation:")
        mem_repo = MemoryRepository()
        mem_create = MemoryCreate(
            memory_text="Finds evening walks help with feeling overwhelmed.",
            category="coping_strategies",
            source="conversation",
            consent_status="approved"
        )
        mem_a = await mem_repo.create(user_id=actual_user_a_id, data=mem_create)
        assert mem_a is not None and mem_a.id is not None
        print(f"   ✓ Memory saved with approved consent: {mem_a.id}")

        active_memories_a = await mem_repo.get_all(user_id=actual_user_a_id, active_only=True)
        assert any(m.id == mem_a.id for m in active_memories_a)
        print(f"   ✓ Active memories retrieved for prompt context: {len(active_memories_a)}")

        # Verify User B sees 0 memories from User A
        memories_b = await mem_repo.get_all(user_id=actual_user_b_id)
        assert len(memories_b) == 0
        print("   ✓ User B emotional memories query returned 0 items (strict isolation confirmed).")

        # Step 6: Test Memory Deletion & Consent Revocation
        print("\n[Step 6] Testing Memory Deletion:")
        deleted = await mem_repo.delete(user_id=actual_user_a_id, memory_id=mem_a.id)
        assert deleted is True
        fetched_after_delete = await mem_repo.get_by_id(user_id=actual_user_a_id, memory_id=mem_a.id)
        assert fetched_after_delete is None
        print("   ✓ Memory deleted successfully. User agency & forgotten context verified.")

        print("\n==================================================================")
        print("✓ ALL LIVE SUPABASE REPOSITORY & DATA PERSISTENCE TESTS PASSED!")
        print("==================================================================")
        return True

    finally:
        # Step 7: Clean up test users from auth.users (cascades to all user tables)
        print("\n[Step 7] Cleaning Up Test Accounts from Supabase Auth:")
        try:
            client.auth.admin.delete_user(actual_user_a_id)
            print(f"   ✓ Test User A ({actual_user_a_id}) cleaned up.")
            client.auth.admin.delete_user(actual_user_b_id)
            print(f"   ✓ Test User B ({actual_user_b_id}) cleaned up.")
        except Exception as cleanup_err:
            print(f"   ⚠️ Cleanup warning: {cleanup_err}")


if __name__ == "__main__":
    success = asyncio.run(run_live_supabase_e2e())
    sys.exit(0 if success else 1)
