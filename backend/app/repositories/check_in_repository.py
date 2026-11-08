import logging
import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.check_in import CheckInCreate, CheckInResponse

logger = logging.getLogger("solace.check_in_repository")

# In-memory store for development/testing when Supabase DB is offline
_in_memory_check_ins: Dict[str, List[Dict[str, Any]]] = {}


class CheckInRepository:
    """Repository handling CRUD operations on the 'check_ins' table."""

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
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        item_id = str(uuid.uuid4())

        payload = {
            "id": item_id,
            "user_id": user_id,
            "mood": data.mood,
            "intensity": data.intensity,
            "note": data.note,
            "created_at": now_iso,
        }

        if client:
            try:
                res = client.table("check_ins").insert(payload).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return CheckInResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        mood=r["mood"],
                        intensity=r["intensity"],
                        note=r.get("note"),
                        created_at=r["created_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase check_ins insert failed, falling back to local: {e}")

        if user_id not in _in_memory_check_ins:
            _in_memory_check_ins[user_id] = []
        _in_memory_check_ins[user_id].insert(0, payload)
        return CheckInResponse(**payload)

    async def get_history(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[CheckInResponse], int]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("check_ins")
                    .select("*", count="exact")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .range(offset, offset + limit - 1)
                    .execute()
                )
                items = [
                    CheckInResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        mood=r["mood"],
                        intensity=r["intensity"],
                        note=r.get("note"),
                        created_at=r["created_at"],
                    )
                    for r in (res.data or [])
                ]
                total = res.count or len(items)
                return items, total
            except Exception as e:
                logger.warning(f"Supabase check_ins query failed, falling back to local: {e}")

        user_items = _in_memory_check_ins.get(user_id, [])
        total = len(user_items)
        sliced = user_items[offset : offset + limit]
        return [CheckInResponse(**it) for it in sliced], total

    async def get_by_id(self, user_id: str, check_in_id: str) -> Optional[CheckInResponse]:
        client = self._get_client()

        if client:
            try:
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
                        id=r["id"],
                        user_id=r["user_id"],
                        mood=r["mood"],
                        intensity=r["intensity"],
                        note=r.get("note"),
                        created_at=r["created_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase get_by_id failed: {e}")

        user_items = _in_memory_check_ins.get(user_id, [])
        for it in user_items:
            if it["id"] == check_in_id:
                return CheckInResponse(**it)
        return None

    async def delete(self, user_id: str, check_in_id: str) -> bool:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("check_ins")
                    .delete()
                    .eq("id", check_in_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data:
                    return True
            except Exception as e:
                logger.warning(f"Supabase delete check_in failed: {e}")

        user_items = _in_memory_check_ins.get(user_id, [])
        initial_len = len(user_items)
        _in_memory_check_ins[user_id] = [it for it in user_items if it["id"] != check_in_id]
        return len(_in_memory_check_ins[user_id]) < initial_len


check_in_repository = CheckInRepository()

