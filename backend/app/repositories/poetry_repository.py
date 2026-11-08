import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.poetry import SavedPoemCreate, SavedPoemResponse, PoetryFormat, PoetryTheme

logger = logging.getLogger("solace.poetry_repository")

# In-memory storage for test/offline fallback
_in_memory_saved_poems: Dict[str, List[Dict[str, Any]]] = {}


class PoetryRepository:
    """Repository handling CRUD operations on the 'words_of_solace' table."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    async def save_poem(self, user_id: str, data: SavedPoemCreate) -> SavedPoemResponse:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        poem_id = str(uuid.uuid4())

        payload = {
            "id": poem_id,
            "user_id": user_id,
            "title": data.title,
            "content": data.content,
            "format": data.format.value if hasattr(data.format, "value") else str(data.format),
            "theme": data.theme.value if hasattr(data.theme, "value") else str(data.theme),
            "secondary_content": data.secondary_content,
            "reflection": data.reflection,
            "metadata": data.metadata or {},
            "created_at": now_iso,
        }

        if client:
            try:
                res = client.table("words_of_solace").insert(payload).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return SavedPoemResponse(
                        id=str(r["id"]),
                        user_id=str(r["user_id"]),
                        title=r["title"],
                        content=r["content"],
                        format=PoetryFormat(r["format"]),
                        theme=PoetryTheme(r["theme"]),
                        secondary_content=r.get("secondary_content"),
                        reflection=r.get("reflection"),
                        metadata=r.get("metadata", {}),
                        created_at=str(r["created_at"]),
                    )
            except Exception as e:
                logger.warning(f"Supabase save poem query failed, falling back to local: {e}")

        # Local fallback store
        if user_id not in _in_memory_saved_poems:
            _in_memory_saved_poems[user_id] = []
        _in_memory_saved_poems[user_id].insert(0, payload)

        return SavedPoemResponse(
            id=payload["id"],
            user_id=payload["user_id"],
            title=payload["title"],
            content=payload["content"],
            format=PoetryFormat(payload["format"]),
            theme=PoetryTheme(payload["theme"]),
            secondary_content=payload["secondary_content"],
            reflection=payload["reflection"],
            metadata=payload["metadata"],
            created_at=payload["created_at"],
        )

    async def get_saved_poems(self, user_id: str, limit: int = 50, offset: int = 0) -> Tuple[List[SavedPoemResponse], int]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("words_of_solace")
                    .select("*", count="exact")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .range(offset, offset + limit - 1)
                    .execute()
                )
                if res and res.data is not None:
                    items = [
                        SavedPoemResponse(
                            id=str(r["id"]),
                            user_id=str(r["user_id"]),
                            title=r["title"],
                            content=r["content"],
                            format=PoetryFormat(r["format"]),
                            theme=PoetryTheme(r["theme"]),
                            secondary_content=r.get("secondary_content"),
                            reflection=r.get("reflection"),
                            metadata=r.get("metadata", {}),
                            created_at=str(r["created_at"]),
                        )
                        for r in res.data
                    ]
                    total = res.count if res.count is not None else len(items)
                    return items, total
            except Exception as e:
                logger.warning(f"Supabase get saved poems query failed, falling back to local: {e}")

        # Local fallback
        user_list = _in_memory_saved_poems.get(user_id, [])
        sliced = user_list[offset : offset + limit]
        items = [
            SavedPoemResponse(
                id=p["id"],
                user_id=p["user_id"],
                title=p["title"],
                content=p["content"],
                format=PoetryFormat(p["format"]),
                theme=PoetryTheme(p["theme"]),
                secondary_content=p.get("secondary_content"),
                reflection=p.get("reflection"),
                metadata=p.get("metadata", {}),
                created_at=p["created_at"],
            )
            for p in sliced
        ]
        return items, len(user_list)

    async def delete_saved_poem(self, user_id: str, poem_id: str) -> bool:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("words_of_solace")
                    .delete()
                    .eq("id", poem_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                return True
            except Exception as e:
                logger.warning(f"Supabase delete poem failed, falling back to local: {e}")

        # Local fallback
        if user_id in _in_memory_saved_poems:
            original_len = len(_in_memory_saved_poems[user_id])
            _in_memory_saved_poems[user_id] = [
                p for p in _in_memory_saved_poems[user_id] if p["id"] != poem_id
            ]
            return len(_in_memory_saved_poems[user_id]) < original_len
        return False


poetry_repository = PoetryRepository()
