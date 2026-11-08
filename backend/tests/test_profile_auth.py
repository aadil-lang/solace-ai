import os
import sys
import jwt
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def create_test_token(user_id: str, email: str = "testuser@solace.ai") -> str:
    """Generate a test JWT matching Supabase Auth token shape."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "app_metadata": {"provider": "email"},
        "user_metadata": {"full_name": "Test User"}
    }
    # If SUPABASE_JWT_SECRET is set, sign with it; otherwise sign with dummy secret for test
    secret = settings.SUPABASE_JWT_SECRET or "test-secret-key-32-chars-minimum!!"
    return jwt.encode(payload, secret, algorithm="HS256")


def test_unauthorized_profile_access():
    """Verify unauthenticated requests to /api/v1/profile/me are rejected with 401."""
    response = client.get("/api/v1/profile/me")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    data = response.json()
    assert "error" in data or "detail" in data
    print("TEST PASSED: Unauthorized GET /api/v1/profile/me correctly returned 401.")


def test_unauthorized_profile_patch():
    """Verify unauthenticated PATCH to /api/v1/profile/me is rejected with 401."""
    response = client.patch("/api/v1/profile/me", json={"preferred_name": "Intruder"})
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("TEST PASSED: Unauthorized PATCH /api/v1/profile/me correctly returned 401.")


def test_authenticated_profile_flow():
    """Verify authenticated user can fetch and update their profile via verified JWT."""
    user_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    email = "mindful.user@solace.ai"
    token = create_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch profile
    get_res = client.get("/api/v1/profile/me", headers=headers)
    assert get_res.status_code == 200, f"Expected 200, got {get_res.status_code}: {get_res.text}"
    profile = get_res.json()
    assert profile["id"] == user_id
    assert profile["email"] == email
    assert profile["onboarding_completed"] is False
    print("TEST PASSED: Authenticated GET /api/v1/profile/me succeeded.")

    # 2. Update profile (e.g. complete onboarding)
    patch_payload = {
        "preferred_name": "Aadil",
        "onboarding_completed": True,
        "wellness_goals": ["Reduce stress", "Mindful breathing"],
        "interaction_style": "gentle"
    }
    patch_res = client.patch("/api/v1/profile/me", json=patch_payload, headers=headers)
    assert patch_res.status_code == 200, f"Expected 200, got {patch_res.status_code}: {patch_res.text}"
    updated_profile = patch_res.json()
    assert updated_profile["preferred_name"] == "Aadil"
    assert updated_profile["onboarding_completed"] is True
    assert "Mindful breathing" in updated_profile["wellness_goals"]
    assert updated_profile["interaction_style"] == "gentle"
    print("TEST PASSED: Authenticated PATCH /api/v1/profile/me updated profile.")

    # 3. Verify changes persist on subsequent GET
    verify_res = client.get("/api/v1/profile/me", headers=headers)
    assert verify_res.status_code == 200
    verified = verify_res.json()
    assert verified["preferred_name"] == "Aadil"
    assert verified["onboarding_completed"] is True
    print("TEST PASSED: Profile updates verified persistent.")


if __name__ == "__main__":
    test_unauthorized_profile_access()
    test_unauthorized_profile_patch()
    test_authenticated_profile_flow()
    print("ALL BACKEND PROFILE & AUTH TESTS COMPLETED SUCCESSFULLY!")

