import logging
import uuid
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.check_in import (
    CheckInCreate,
    CheckInResponse,
    LandscapeReflectionCreate,
    LandscapeReflectionRecord,
)

logger = logging.getLogger("solace.check_in_repository")


class CheckInRepository:
    """Repository handling CRUD operations on 'check_ins' and 'landscape_reflections'."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    async def create(self, user_id: str, data: CheckInCreate) -> CheckInResponse:
        """Create a new check-in. Raises RuntimeError if cloud storage is unavailable."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable for cloud check-in persistence")

        # Preserve original client timestamp if provided for offline sync; else now (UTC)
        created_at = data.created_at or datetime.now(timezone.utc).isoformat()
        item_id = str(uuid.uuid4())

        payload = {
            "id": item_id,
            "user_id": user_id,
            "mood": data.mood,
            "intensity": data.intensity,
            "note": data.note,
            "is_meaningful": data.is_meaningful,
            "created_at": created_at,
        }

        try:
            res = client.table("check_ins").insert(payload).execute()
            if res and res.data and len(res.data) > 0:
                r = res.data[0]
                return CheckInResponse(
                    id=str(r["id"]),
                    user_id=str(r["user_id"]),
                    mood=r["mood"],
                    intensity=r["intensity"],
                    note=r.get("note"),
                    is_meaningful=bool(r.get("is_meaningful", False)),
                    created_at=str(r["created_at"]),
                )
            raise RuntimeError("Supabase returned empty response on check_ins insert")
        except Exception as e:
            logger.error(f"Supabase check_ins insert failed for user {user_id}: {e}")
            raise e

    async def get_history(
        self, user_id: str, limit: int = 20, offset: int = 0, is_meaningful_only: bool = False
    ) -> Tuple[List[CheckInResponse], int]:
        """Retrieve paginated check-in history, optionally filtered to meaningful bookmarks."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        query = (
            client.table("check_ins")
            .select("*", count="exact")
            .eq("user_id", user_id)
        )
        if is_meaningful_only:
            query = query.eq("is_meaningful", True)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        items = [
            CheckInResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                mood=r["mood"],
                intensity=r["intensity"],
                note=r.get("note"),
                is_meaningful=bool(r.get("is_meaningful", False)),
                created_at=str(r["created_at"]),
            )
            for r in (res.data or [])
        ]
        total = res.count or len(items)
        return items, total

    async def get_by_id(self, user_id: str, check_in_id: str) -> Optional[CheckInResponse]:
        """Retrieve a single check-in by ID ensuring user ownership."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        res = (
            client.table("check_ins")
            .select("*")
            .eq("id", check_in_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if res and res.data:
            r = res.data
            return CheckInResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                mood=r["mood"],
                intensity=r["intensity"],
                note=r.get("note"),
                is_meaningful=bool(r.get("is_meaningful", False)),
                created_at=str(r["created_at"]),
            )
        return None

    async def toggle_meaningful(
        self, user_id: str, check_in_id: str, is_meaningful: bool
    ) -> Optional[CheckInResponse]:
        """Update ONLY the is_meaningful bookmark flag on a check-in."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        # Explicitly restrict update to 'is_meaningful' only
        payload = {"is_meaningful": is_meaningful}

        res = (
            client.table("check_ins")
            .update(payload)
            .eq("id", check_in_id)
            .eq("user_id", user_id)
            .execute()
        )

        if res and res.data and len(res.data) > 0:
            r = res.data[0]
            return CheckInResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                mood=r["mood"],
                intensity=r["intensity"],
                note=r.get("note"),
                is_meaningful=bool(r.get("is_meaningful", False)),
                created_at=str(r["created_at"]),
            )
        return None

    async def delete(self, user_id: str, check_in_id: str) -> bool:
        """Delete a check-in with user ownership isolation."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        res = (
            client.table("check_ins")
            .delete()
            .eq("id", check_in_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res and res.data and len(res.data) > 0)

    async def get_check_ins_in_range(
        self, user_id: str, start_iso: Optional[str] = None, end_iso: Optional[str] = None
    ) -> List[CheckInResponse]:
        """Retrieve check-ins within a UTC timestamp range for deterministic analytics."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        query = client.table("check_ins").select("*").eq("user_id", user_id)
        if start_iso:
            query = query.gte("created_at", start_iso)
        if end_iso:
            query = query.lte("created_at", end_iso)

        query = query.order("created_at", desc=True)
        res = query.execute()

        return [
            CheckInResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                mood=r["mood"],
                intensity=r["intensity"],
                note=r.get("note"),
                is_meaningful=bool(r.get("is_meaningful", False)),
                created_at=str(r["created_at"]),
            )
            for r in (res.data or [])
        ]

    # --- Landscape Saved Reflections ---

    async def save_reflection(
        self, user_id: str, data: LandscapeReflectionCreate
    ) -> LandscapeReflectionRecord:
        """Durable save of an explicitly user-consented reflection."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        now_iso = datetime.now(timezone.utc).isoformat()
        item_id = str(uuid.uuid4())

        payload = {
            "id": item_id,
            "user_id": user_id,
            "timeframe": data.timeframe,
            "reflection": data.reflection,
            "dominant_mood": data.dominant_mood,
            "created_at": now_iso,
        }

        res = client.table("landscape_reflections").insert(payload).execute()
        if res and res.data and len(res.data) > 0:
            r = res.data[0]
            return LandscapeReflectionRecord(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                timeframe=r["timeframe"],
                reflection=r["reflection"],
                dominant_mood=r.get("dominant_mood"),
                created_at=str(r["created_at"]),
            )
        raise RuntimeError("Failed to insert landscape reflection into database")

    async def get_reflections(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[LandscapeReflectionRecord], int]:
        """Retrieve user's saved landscape reflections."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        res = (
            client.table("landscape_reflections")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        items = [
            LandscapeReflectionRecord(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                timeframe=r["timeframe"],
                reflection=r["reflection"],
                dominant_mood=r.get("dominant_mood"),
                created_at=str(r["created_at"]),
            )
            for r in (res.data or [])
        ]
        total = res.count or len(items)
        return items, total

    async def delete_reflection(self, user_id: str, reflection_id: str) -> bool:
        """Delete a saved reflection."""
        client = self._get_client()
        if not client:
            raise RuntimeError("Database connection unavailable")

        res = (
            client.table("landscape_reflections")
            .delete()
            .eq("id", reflection_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res and res.data and len(res.data) > 0)


check_in_repository = CheckInRepository()
