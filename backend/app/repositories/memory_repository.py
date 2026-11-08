import logging
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse

logger = logging.getLogger("solace.memory_repository")

# In-memory store for development/testing when Supabase DB is offline
_in_memory_user_memories: Dict[str, List[Dict[str, Any]]] = {}


class MemoryRepository:
    """Repository handling CRUD operations on the 'user_memories' table."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    async def create(self, user_id: str, data: MemoryCreate) -> MemoryResponse:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        memory_id = str(uuid.uuid4())

        payload = {
            "id": memory_id,
            "user_id": user_id,
            "memory_text": data.memory_text,
            "category": data.category,
            "source": data.source,
            "consent_status": data.consent_status,
            "is_active": True,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        if client:
            try:
                res = client.table("user_memories").insert(payload).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return MemoryResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        memory_text=r["memory_text"],
                        category=r["category"],
                        source=r["source"],
                        consent_status=r["consent_status"],
                        is_active=r["is_active"],
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase create memory failed: {e}")

        if user_id not in _in_memory_user_memories:
            _in_memory_user_memories[user_id] = []
        _in_memory_user_memories[user_id].insert(0, payload)
        return MemoryResponse(**payload)

    async def get_all(self, user_id: str, active_only: bool = False) -> List[MemoryResponse]:
        client = self._get_client()

        if client:
            try:
                q = client.table("user_memories").select("*").eq("user_id", user_id)
                if active_only:
                    q = q.eq("is_active", True).eq("consent_status", "approved")
                res = q.order("created_at", desc=True).execute()
                return [
                    MemoryResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        memory_text=r["memory_text"],
                        category=r["category"],
                        source=r["source"],
                        consent_status=r["consent_status"],
                        is_active=r["is_active"],
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                    )
                    for r in (res.data or [])
                ]
            except Exception as e:
                logger.warning(f"Supabase get_all memories failed: {e}")

        items = _in_memory_user_memories.get(user_id, [])
        if active_only:
            items = [it for it in items if it["is_active"] and it["consent_status"] == "approved"]
        return [MemoryResponse(**it) for it in items]

    async def get_by_id(self, user_id: str, memory_id: str) -> Optional[MemoryResponse]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("user_memories")
                    .select("*")
                    .eq("id", memory_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                if res and res.data:
                    r = res.data
                    return MemoryResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        memory_text=r["memory_text"],
                        category=r["category"],
                        source=r["source"],
                        consent_status=r["consent_status"],
                        is_active=r["is_active"],
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase get_by_id memory failed: {e}")

        items = _in_memory_user_memories.get(user_id, [])
        for it in items:
            if it["id"] == memory_id:
                return MemoryResponse(**it)
        return None

    async def update(self, user_id: str, memory_id: str, updates: MemoryUpdate) -> Optional[MemoryResponse]:
        client = self._get_client()
        update_dict = updates.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        if client:
            try:
                res = (
                    client.table("user_memories")
                    .update(update_dict)
                    .eq("id", memory_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return MemoryResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        memory_text=r["memory_text"],
                        category=r["category"],
                        source=r["source"],
                        consent_status=r["consent_status"],
                        is_active=r["is_active"],
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase update memory failed: {e}")

        items = _in_memory_user_memories.get(user_id, [])
        for it in items:
            if it["id"] == memory_id:
                it.update(update_dict)
                return MemoryResponse(**it)
        return None

    async def delete(self, user_id: str, memory_id: str) -> bool:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("user_memories")
                    .delete()
                    .eq("id", memory_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data:
                    return True
            except Exception as e:
                logger.warning(f"Supabase delete memory failed: {e}")

        items = _in_memory_user_memories.get(user_id, [])
        initial_len = len(items)
        _in_memory_user_memories[user_id] = [it for it in items if it["id"] != memory_id]
        return len(_in_memory_user_memories[user_id]) < initial_len


memory_repository = MemoryRepository()

