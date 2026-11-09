import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.journal import (
    JournalCreateRequest,
    JournalUpdateRequest,
    JournalResponse,
)

logger = logging.getLogger("solace.journal_repository")

# In-memory storage for test/offline fallback
_in_memory_journals: Dict[str, List[Dict[str, Any]]] = {}


class JournalRepository:
    """Repository handling CRUD operations on the 'voice_journals' table with strict user isolation."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    async def save_journal(self, user_id: str, data: JournalCreateRequest) -> JournalResponse:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        journal_id = str(uuid.uuid4())

        payload = {
            "id": journal_id,
            "user_id": user_id,
            "title": data.title or "Voice Reflection",
            "transcript": data.transcript,
            "mood_tag": data.mood_tag,
            "duration_seconds": data.duration_seconds or 0,
            "reflection": data.reflection,
            "metadata": data.metadata or {},
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        if client:
            try:
                res = client.table("voice_journals").insert(payload).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return JournalResponse(
                        id=str(r["id"]),
                        user_id=str(r["user_id"]),
                        title=r["title"],
                        transcript=r["transcript"],
                        mood_tag=r.get("mood_tag"),
                        duration_seconds=r.get("duration_seconds", 0),
                        reflection=r.get("reflection"),
                        metadata=r.get("metadata", {}),
                        created_at=str(r["created_at"]),
                        updated_at=str(r.get("updated_at", r["created_at"])),
                    )
            except Exception as e:
                logger.warning(f"Supabase save journal query failed, falling back to local: {e}")

        # Local fallback store
        if user_id not in _in_memory_journals:
            _in_memory_journals[user_id] = []
        _in_memory_journals[user_id].insert(0, payload)

        return JournalResponse(
            id=payload["id"],
            user_id=payload["user_id"],
            title=payload["title"],
            transcript=payload["transcript"],
            mood_tag=payload["mood_tag"],
            duration_seconds=payload["duration_seconds"],
            reflection=payload["reflection"],
            metadata=payload["metadata"],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    async def get_journals(self, user_id: str, limit: int = 50, offset: int = 0) -> Tuple[List[JournalResponse], int]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("voice_journals")
                    .select("*", count="exact")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .range(offset, offset + limit - 1)
                    .execute()
                )
                if res and res.data is not None:
                    items = [
                        JournalResponse(
                            id=str(r["id"]),
                            user_id=str(r["user_id"]),
                            title=r["title"],
                            transcript=r["transcript"],
                            mood_tag=r.get("mood_tag"),
                            duration_seconds=r.get("duration_seconds", 0),
                            reflection=r.get("reflection"),
                            metadata=r.get("metadata", {}),
                            created_at=str(r["created_at"]),
                            updated_at=str(r.get("updated_at", r["created_at"])),
                        )
                        for r in res.data
                    ]
                    total = res.count if res.count is not None else len(items)
                    return items, total
            except Exception as e:
                logger.warning(f"Supabase get journals query failed, falling back to local: {e}")

        # Local fallback
        all_user_items = _in_memory_journals.get(user_id, [])
        sliced = all_user_items[offset : offset + limit]
        return [
            JournalResponse(
                id=item["id"],
                user_id=item["user_id"],
                title=item["title"],
                transcript=item["transcript"],
                mood_tag=item.get("mood_tag"),
                duration_seconds=item.get("duration_seconds", 0),
                reflection=item.get("reflection"),
                metadata=item.get("metadata", {}),
                created_at=item["created_at"],
                updated_at=item.get("updated_at", item["created_at"]),
            )
            for item in sliced
        ], len(all_user_items)

    async def get_journal_by_id(self, user_id: str, journal_id: str) -> Optional[JournalResponse]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("voice_journals")
                    .select("*")
                    .eq("id", journal_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return JournalResponse(
                        id=str(r["id"]),
                        user_id=str(r["user_id"]),
                        title=r["title"],
                        transcript=r["transcript"],
                        mood_tag=r.get("mood_tag"),
                        duration_seconds=r.get("duration_seconds", 0),
                        reflection=r.get("reflection"),
                        metadata=r.get("metadata", {}),
                        created_at=str(r["created_at"]),
                        updated_at=str(r.get("updated_at", r["created_at"])),
                    )
                return None
            except Exception as e:
                logger.warning(f"Supabase get journal by ID failed, falling back to local: {e}")

        for item in _in_memory_journals.get(user_id, []):
            if item["id"] == journal_id:
                return JournalResponse(
                    id=item["id"],
                    user_id=item["user_id"],
                    title=item["title"],
                    transcript=item["transcript"],
                    mood_tag=item.get("mood_tag"),
                    duration_seconds=item.get("duration_seconds", 0),
                    reflection=item.get("reflection"),
                    metadata=item.get("metadata", {}),
                    created_at=item["created_at"],
                    updated_at=item.get("updated_at", item["created_at"]),
                )
        return None

    async def update_journal(
        self, user_id: str, journal_id: str, data: JournalUpdateRequest
    ) -> Optional[JournalResponse]:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        update_payload: Dict[str, Any] = {"updated_at": now_iso}
        if data.title is not None:
            update_payload["title"] = data.title
        if data.transcript is not None:
            update_payload["transcript"] = data.transcript
        if data.mood_tag is not None:
            update_payload["mood_tag"] = data.mood_tag
        if data.reflection is not None:
            update_payload["reflection"] = data.reflection

        if client:
            try:
                res = (
                    client.table("voice_journals")
                    .update(update_payload)
                    .eq("id", journal_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return JournalResponse(
                        id=str(r["id"]),
                        user_id=str(r["user_id"]),
                        title=r["title"],
                        transcript=r["transcript"],
                        mood_tag=r.get("mood_tag"),
                        duration_seconds=r.get("duration_seconds", 0),
                        reflection=r.get("reflection"),
                        metadata=r.get("metadata", {}),
                        created_at=str(r["created_at"]),
                        updated_at=str(r.get("updated_at", r["created_at"])),
                    )
                return None
            except Exception as e:
                logger.warning(f"Supabase update journal query failed, falling back to local: {e}")

        # Local fallback
        for item in _in_memory_journals.get(user_id, []):
            if item["id"] == journal_id:
                if data.title is not None:
                    item["title"] = data.title
                if data.transcript is not None:
                    item["transcript"] = data.transcript
                if data.mood_tag is not None:
                    item["mood_tag"] = data.mood_tag
                if data.reflection is not None:
                    item["reflection"] = data.reflection
                item["updated_at"] = now_iso

                return JournalResponse(
                    id=item["id"],
                    user_id=item["user_id"],
                    title=item["title"],
                    transcript=item["transcript"],
                    mood_tag=item.get("mood_tag"),
                    duration_seconds=item.get("duration_seconds", 0),
                    reflection=item.get("reflection"),
                    metadata=item.get("metadata", {}),
                    created_at=item["created_at"],
                    updated_at=item["updated_at"],
                )
        return None

    async def delete_journal(self, user_id: str, journal_id: str) -> bool:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("voice_journals")
                    .delete()
                    .eq("id", journal_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data and len(res.data) > 0:
                    return True
                return False
            except Exception as e:
                logger.warning(f"Supabase delete journal query failed, falling back to local: {e}")

        # Local fallback
        user_items = _in_memory_journals.get(user_id, [])
        for i, item in enumerate(user_items):
            if item["id"] == journal_id:
                user_items.pop(i)
                return True
        return False


journal_repository = JournalRepository()
