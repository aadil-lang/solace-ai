import asyncio
import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
import zoneinfo
import jwt
from pydantic import ValidationError

# Set Windows Selector Event Loop Policy to prevent IOCP loopback socket blocking on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.schemas.check_in import (
    CheckInCreate,
    CheckInResponse,
    CheckInMeaningfulUpdate,
    LandscapeSummaryResponse,
    LandscapeReflectionRequest,
    LandscapeReflectionResponse,
    LandscapeReflectionCreate,
    LandscapeReflectionRecord,
)
from app.services.landscape_service import (
    landscape_service,
    MOOD_ORDER,
    FALLBACK_LANDSCAPE_REFLECTION,
)
from app.repositories.check_in_repository import check_in_repository
from app.services.ai_provider import AIProviderInterface, set_custom_ai_provider

test_client = TestClient(app)


def create_test_jwt(user_id: str, email: str = "landscape_test@solace.ai") -> str:
    """Generate a test JWT matching Supabase Auth token shape."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "app_metadata": {"provider": "email"},
        "user_metadata": {"full_name": "Landscape Test User"},
    }
    secret = settings.SUPABASE_JWT_SECRET or "test-secret-key-32-chars-minimum!!"
    return jwt.encode(payload, secret, algorithm="HS256")


class MockLandscapeAIProvider(AIProviderInterface):
    """Mock AI Provider for testing contemplative landscape reflections."""

    def __init__(self, failure_mode: bool = False, simulated_text: str = None):
        self.failure_mode = failure_mode
        self.simulated_text = simulated_text or (
            "Your days have settled into a quiet, reflective tempo this past week. "
            "Allowing room for both the stillness and the passing moments of warmth is a gentle way to stay centered."
        )

    async def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        if self.failure_mode:
            raise RuntimeError("Simulated Gemini API timeout or rate limit")
        return self.simulated_text

    async def generate_response_stream(self, prompt: str, system_prompt: str = None, history=None):
        yield self.simulated_text

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/mp4") -> str:
        return "Simulated transcription"


def make_test_check_in(
    item_id: str,
    mood: str,
    intensity: int,
    created_at_utc: str,
    note: str = None,
    is_meaningful: bool = False,
    user_id: str = "user-123",
) -> CheckInResponse:
    return CheckInResponse(
        id=item_id,
        user_id=user_id,
        mood=mood,
        intensity=intensity,
        note=note,
        is_meaningful=is_meaningful,
        created_at=created_at_utc,
    )


class TestEmotionalLandscapeDeterministicAnalytics(unittest.TestCase):
    """Unit tests for deterministic calculations, empty states, and timezone logic."""

    def test_empty_check_ins_summary(self):
        """When 0 check-ins exist, all averages and dominants must be strictly None, counts 0."""
        summary = landscape_service.calculate_summary(check_ins=[], timeframe="7d", tz_name="UTC")
        self.assertEqual(summary.total_moments, 0)
        self.assertIsNone(summary.dominant_season)
        self.assertIsNone(summary.average_intensity)
        self.assertIsNone(summary.busiest_time_of_day)
        self.assertEqual(summary.meaningful_moments_count, 0)

        for item in summary.season_distribution:
            self.assertEqual(item.count, 0)
            self.assertEqual(item.percentage, 0.0)

    def test_single_check_in_summary(self):
        """Single check-in should have 100% distribution and matching dominant mood and intensity."""
        item = make_test_check_in("1", "peaceful", 4, "2026-11-09T10:00:00Z")
        summary = landscape_service.calculate_summary(check_ins=[item], timeframe="all", tz_name="UTC")

        self.assertEqual(summary.total_moments, 1)
        self.assertEqual(summary.dominant_season, "peaceful")
        self.assertEqual(summary.average_intensity, 4.0)

        peaceful_item = next(d for d in summary.season_distribution if d.mood == "peaceful")
        self.assertEqual(peaceful_item.count, 1)
        self.assertEqual(peaceful_item.percentage, 100.0)

        other_items = [d for d in summary.season_distribution if d.mood != "peaceful"]
        for o in other_items:
            self.assertEqual(o.count, 0)
            self.assertEqual(o.percentage, 0.0)

    def test_dominant_season_tie_breaking(self):
        """When two moods have the same count, the tie breaker selects the most recently logged mood."""
        # 2 'hopeful' entries logged earlier
        c1 = make_test_check_in("1", "hopeful", 3, "2026-11-08T08:00:00Z")
        c2 = make_test_check_in("2", "hopeful", 4, "2026-11-08T12:00:00Z")

        # 2 'reflective' entries logged later
        c3 = make_test_check_in("3", "reflective", 3, "2026-11-09T09:00:00Z")
        c4 = make_test_check_in("4", "reflective", 2, "2026-11-09T14:00:00Z")

        summary = landscape_service.calculate_summary(
            check_ins=[c1, c2, c3, c4], timeframe="all", tz_name="UTC"
        )
        self.assertEqual(summary.total_moments, 4)
        # 'reflective' was logged most recently (14:00 > 12:00)
        self.assertEqual(summary.dominant_season, "reflective")
        self.assertEqual(summary.average_intensity, 3.0)

    def test_timezone_aware_time_of_day_categorization(self):
        """Verify local time-of-day windows in different timezones."""
        # UTC 02:30 -> Asia/Kolkata is +05:30 -> 08:00 local (morning: 05:00-11:59)
        c_morning = make_test_check_in("1", "peaceful", 3, "2026-11-09T02:30:00Z")
        # UTC 08:00 -> Asia/Kolkata is +05:30 -> 13:30 local (afternoon: 12:00-16:59)
        c_afternoon = make_test_check_in("2", "grateful", 4, "2026-11-09T08:00:00Z")
        # UTC 13:00 -> Asia/Kolkata is +05:30 -> 18:30 local (evening: 17:00-21:59)
        c_evening = make_test_check_in("3", "reflective", 2, "2026-11-09T13:00:00Z")
        # UTC 17:00 -> Asia/Kolkata is +05:30 -> 22:30 local (night: 22:00-04:59)
        c_night = make_test_check_in("4", "heavy", 3, "2026-11-09T17:00:00Z")

        tz_kolkata = landscape_service.get_user_zoneinfo("Asia/Kolkata")
        dt_m = landscape_service.parse_utc_timestamp(c_morning.created_at).astimezone(tz_kolkata)
        dt_a = landscape_service.parse_utc_timestamp(c_afternoon.created_at).astimezone(tz_kolkata)
        dt_e = landscape_service.parse_utc_timestamp(c_evening.created_at).astimezone(tz_kolkata)
        dt_n = landscape_service.parse_utc_timestamp(c_night.created_at).astimezone(tz_kolkata)

        self.assertEqual(landscape_service.classify_time_of_day(dt_m), "morning")
        self.assertEqual(landscape_service.classify_time_of_day(dt_a), "afternoon")
        self.assertEqual(landscape_service.classify_time_of_day(dt_e), "evening")
        self.assertEqual(landscape_service.classify_time_of_day(dt_n), "night")

        # In summary calculation, if 2 mornings and 1 afternoon exist
        c_morning_2 = make_test_check_in("5", "peaceful", 3, "2026-11-08T03:00:00Z")
        summary = landscape_service.calculate_summary(
            check_ins=[c_morning, c_morning_2, c_afternoon], timeframe="all", tz_name="Asia/Kolkata"
        )
        self.assertEqual(summary.busiest_time_of_day, "morning")

    def test_daylight_saving_transitions(self):
        """Test DST transition dates (US Eastern Time: New York) to verify timezone arithmetic."""
        tz_ny = landscape_service.get_user_zoneinfo("America/New_York")

        # Before transition (EDT, UTC-4): 2026-10-31 16:00 UTC -> 12:00 EDT (afternoon)
        dt_before = datetime(2026, 10, 31, 16, 0, tzinfo=timezone.utc).astimezone(tz_ny)
        self.assertEqual(landscape_service.classify_time_of_day(dt_before), "afternoon")

        # After transition (EST, UTC-5): 2026-11-02 16:00 UTC -> 11:00 EST (morning)
        dt_after = datetime(2026, 11, 2, 16, 0, tzinfo=timezone.utc).astimezone(tz_ny)
        self.assertEqual(landscape_service.classify_time_of_day(dt_after), "morning")

    def test_meaningful_moments_count(self):
        """Only explicitly marked check-ins contribute to meaningful moments count."""
        c1 = make_test_check_in("1", "peaceful", 3, "2026-11-08T10:00:00Z", is_meaningful=True)
        c2 = make_test_check_in("2", "grateful", 4, "2026-11-08T11:00:00Z", is_meaningful=False)
        c3 = make_test_check_in("3", "reflective", 2, "2026-11-08T12:00:00Z", is_meaningful=True)

        summary = landscape_service.calculate_summary(check_ins=[c1, c2, c3], timeframe="all", tz_name="UTC")
        self.assertEqual(summary.meaningful_moments_count, 2)


class TestBookmarkUpdateRestriction(unittest.TestCase):
    """Test schema and repository enforcement that ONLY is_meaningful can be modified."""

    def test_future_timestamp_rejected(self):
        """Unreasonable future created_at timestamps (>5min in future) are rejected."""
        future_iso = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        with self.assertRaises(ValidationError):
            CheckInCreate(mood="peaceful", intensity=3, created_at=future_iso)

        # Valid past timestamp is accepted
        valid_past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        req = CheckInCreate(mood="peaceful", intensity=3, created_at=valid_past)
        self.assertEqual(req.created_at, valid_past)

    def test_pydantic_rejects_unauthorized_fields(self):
        """Attempting to mutate mood, intensity, note, or created_at via CheckInMeaningfulUpdate is rejected."""
        valid = CheckInMeaningfulUpdate(is_meaningful=True)
        self.assertTrue(valid.is_meaningful)

        with self.assertRaises(ValidationError):
            CheckInMeaningfulUpdate(is_meaningful=True, mood="peaceful")

        with self.assertRaises(ValidationError):
            CheckInMeaningfulUpdate(is_meaningful=True, intensity=5)

        with self.assertRaises(ValidationError):
            CheckInMeaningfulUpdate(is_meaningful=True, note="Hacked note")

        with self.assertRaises(ValidationError):
            CheckInMeaningfulUpdate(is_meaningful=True, user_id="hacked-user")


class TestRemovalOfInMemoryFallback(unittest.TestCase):
    """Verify that backend repository raises RuntimeError when Supabase DB is offline."""

    def test_create_raises_when_client_unavailable(self):
        """Without Supabase client, create() must raise RuntimeError and never silently save to RAM."""
        orig_get_client = check_in_repository._get_client
        check_in_repository._get_client = lambda: None

        try:
            req = CheckInCreate(mood="peaceful", intensity=3, note="Testing DB offline")
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(check_in_repository.create(user_id="user-123", data=req))
            self.assertIn("unavailable", str(ctx.exception).lower())
        finally:
            check_in_repository._get_client = orig_get_client


class TestContemplativeReflectionAndCrisis(unittest.TestCase):
    """Verify AI reflection generation, fallback, and deterministic crisis safety."""

    def setUp(self):
        set_custom_ai_provider(MockLandscapeAIProvider())

    def tearDown(self):
        set_custom_ai_provider(None)

    def test_normal_reflection_generation(self):
        """Normal check-ins generate a gentle 2-3 sentence reflection."""
        check_ins = [
            make_test_check_in("1", "reflective", 3, "2026-11-08T10:00:00Z", note="Taking time to breathe"),
            make_test_check_in("2", "peaceful", 2, "2026-11-09T10:00:00Z", note="Quiet walk in the park"),
        ]
        req = LandscapeReflectionRequest(timeframe="7d")
        res = asyncio.run(landscape_service.generate_reflection(req, check_ins))

        self.assertFalse(res.is_crisis_override)
        self.assertIn("reflective tempo", res.reflection)
        self.assertIn(res.dominant_season, ["reflective", "peaceful"])

    def test_crisis_screening_intercepts_harm_notes(self):
        """Check-in notes containing crisis keywords trigger immediate emergency override."""
        crisis_check_ins = [
            make_test_check_in(
                "1", "heavy", 5, "2026-11-09T10:00:00Z",
                note="I cannot take this anymore, I want to end my life and kill myself tonight"
            )
        ]
        req = LandscapeReflectionRequest(timeframe="7d")
        res = asyncio.run(landscape_service.generate_reflection(req, crisis_check_ins))

        self.assertTrue(res.is_crisis_override)
        self.assertTrue("14416" in res.reflection or "112" in res.reflection)

    def test_ai_failure_uses_safe_fallback(self):
        """When AI provider fails, system returns safe static reflection without crashing."""
        set_custom_ai_provider(MockLandscapeAIProvider(failure_mode=True))
        check_ins = [
            make_test_check_in("1", "hopeful", 4, "2026-11-09T10:00:00Z", note="Starting a new chapter")
        ]
        req = LandscapeReflectionRequest(timeframe="7d")
        res = asyncio.run(landscape_service.generate_reflection(req, check_ins))

        self.assertFalse(res.is_crisis_override)
        self.assertEqual(res.reflection, FALLBACK_LANDSCAPE_REFLECTION)


class TestLandscapeAPIRoutes(unittest.TestCase):
    """Test HTTP API routes, authentication enforcement, and input validation."""

    def setUp(self):
        set_custom_ai_provider(MockLandscapeAIProvider())
        self.user_a = "11111111-1111-1111-1111-111111111111"
        self.token_a = create_test_jwt(self.user_a)

    def tearDown(self):
        set_custom_ai_provider(None)

    def test_unauthenticated_requests_blocked(self):
        """Unauthenticated requests to landscape endpoints must return 401."""
        endpoints = [
            ("GET", "/api/v1/check-ins/landscape/summary"),
            ("PATCH", "/api/v1/check-ins/test-id/meaningful"),
            ("POST", "/api/v1/check-ins/landscape/reflect"),
            ("POST", "/api/v1/check-ins/landscape/reflections"),
            ("GET", "/api/v1/check-ins/landscape/reflections"),
            ("DELETE", "/api/v1/check-ins/landscape/reflections/test-id"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                res = test_client.get(ep)
            elif method == "POST":
                res = test_client.post(ep, json={})
            elif method == "PATCH":
                res = test_client.patch(ep, json={"is_meaningful": True})
            elif method == "DELETE":
                res = test_client.delete(ep)
            self.assertEqual(res.status_code, 401, f"Expected 401 for {method} {ep}, got {res.status_code}")

    def test_meaningful_patch_rejects_extra_fields_via_http(self):
        """HTTP PATCH /check-ins/{id}/meaningful with extra fields returns 422 Unprocessable Entity."""
        headers = {"Authorization": f"Bearer {self.token_a}"}
        payload = {"is_meaningful": True, "mood": "anxious"}
        res = test_client.patch(
            "/api/v1/check-ins/c1a2b3c4-d5e6-7890-abcd-ef1234567890/meaningful",
            json=payload,
            headers=headers,
        )
        self.assertEqual(res.status_code, 422, "Extra fields in meaningful update must return 422")

    def test_reflection_endpoint_with_direct_check_ins(self):
        """POST /landscape/reflect with selected_check_ins generates reflection without saving."""
        headers = {"Authorization": f"Bearer {self.token_a}"}
        payload = {
            "timeframe": "7d",
            "selected_check_ins": [
                {
                    "id": "c1",
                    "user_id": self.user_a,
                    "mood": "peaceful",
                    "intensity": 3,
                    "note": "A restful afternoon in the garden",
                    "created_at": "2026-11-09T10:00:00Z",
                }
            ],
        }
        res = test_client.post("/api/v1/check-ins/landscape/reflect", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("reflection", data)
        self.assertFalse(data["is_crisis_override"])
        self.assertEqual(data["dominant_season"], "peaceful")

    def test_reflection_endpoint_crisis_detection(self):
        """POST /landscape/reflect with crisis note triggers emergency override in API response."""
        headers = {"Authorization": f"Bearer {self.token_a}"}
        payload = {
            "timeframe": "7d",
            "selected_check_ins": [
                {
                    "id": "c2",
                    "user_id": self.user_a,
                    "mood": "heavy",
                    "intensity": 5,
                    "note": "I want to end my life and die tonight",
                    "created_at": "2026-11-09T10:00:00Z",
                }
            ],
        }
        res = test_client.post("/api/v1/check-ins/landscape/reflect", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["is_crisis_override"])
        self.assertTrue("14416" in data["reflection"] or "112" in data["reflection"])


if __name__ == "__main__":
    unittest.main()
