import logging
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.conversation import (
    ConversationSessionResponse,
    ConversationMessageCreate,
    ConversationMessageResponse,
)

logger = logging.getLogger("solace.conversation_repository")

# In-memory stores for development/testing when Supabase DB is offline
_in_memory_sessions: Dict[str, List[Dict[str, Any]]] = {}
_in_memory_messages: Dict[str, List[Dict[str, Any]]] = {}


class ConversationRepository:
    """Repository handling conversation sessions and independently persisted messages."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    # --- Session Management ---

    async def create_session(self, user_id: str, title: Optional[str] = None) -> ConversationSessionResponse:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        session_id = str(uuid.uuid4())

        payload = {
            "id": session_id,
            "user_id": user_id,
            "title": title or "Reflection with Solace",
            "created_at": now_iso,
            "updated_at": now_iso,
            "archived_at": None,
        }

        if client:
            try:
                res = client.table("conversation_sessions").insert(payload).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return ConversationSessionResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        title=r.get("title"),
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                        archived_at=r.get("archived_at"),
                        message_count=0,
                    )
            except Exception as e:
                logger.warning(f"Supabase create_session failed: {e}")

        if user_id not in _in_memory_sessions:
            _in_memory_sessions[user_id] = []
        _in_memory_sessions[user_id].insert(0, payload)
        return ConversationSessionResponse(**payload, message_count=0)

    async def get_sessions(self, user_id: str) -> List[ConversationSessionResponse]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("conversation_sessions")
                    .select("*, conversation_messages(count)")
                    .eq("user_id", user_id)
                    .order("updated_at", desc=True)
                    .execute()
                )
                sessions = []
                for r in (res.data or []):
                    msg_count = 0
                    if "conversation_messages" in r and r["conversation_messages"]:
                        msg_count = r["conversation_messages"][0].get("count", 0)
                    sessions.append(
                        ConversationSessionResponse(
                            id=r["id"],
                            user_id=r["user_id"],
                            title=r.get("title"),
                            created_at=r["created_at"],
                            updated_at=r["updated_at"],
                            archived_at=r.get("archived_at"),
                            message_count=msg_count,
                        )
                    )
                return sessions
            except Exception as e:
                logger.warning(f"Supabase get_sessions failed: {e}")

        user_sessions = _in_memory_sessions.get(user_id, [])
        result = []
        for s in user_sessions:
            msgs = _in_memory_messages.get(s["id"], [])
            result.append(ConversationSessionResponse(**s, message_count=len(msgs)))
        return result

    async def get_session_by_id(self, user_id: str, session_id: str) -> Optional[ConversationSessionResponse]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("conversation_sessions")
                    .select("*")
                    .eq("id", session_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                if res and res.data:
                    r = res.data
                    msgs = await self.get_messages(user_id, session_id)
                    return ConversationSessionResponse(
                        id=r["id"],
                        user_id=r["user_id"],
                        title=r.get("title"),
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                        archived_at=r.get("archived_at"),
                        message_count=len(msgs),
                    )
            except Exception as e:
                logger.warning(f"Supabase get_session_by_id failed: {e}")

        user_sessions = _in_memory_sessions.get(user_id, [])
        for s in user_sessions:
            if s["id"] == session_id:
                msgs = _in_memory_messages.get(session_id, [])
                return ConversationSessionResponse(**s, message_count=len(msgs))
        return None

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("conversation_sessions")
                    .delete()
                    .eq("id", session_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if res and res.data:
                    return True
            except Exception as e:
                logger.warning(f"Supabase delete_session failed: {e}")

        user_sessions = _in_memory_sessions.get(user_id, [])
        initial_len = len(user_sessions)
        _in_memory_sessions[user_id] = [s for s in user_sessions if s["id"] != session_id]
        if session_id in _in_memory_messages:
            del _in_memory_messages[session_id]
        return len(_in_memory_sessions[user_id]) < initial_len

    # --- Message Management ---

    async def create_message(
        self, session_id: str, user_id: str, data: ConversationMessageCreate
    ) -> ConversationMessageResponse:
        client = self._get_client()
        now_iso = datetime.now(timezone.utc).isoformat()
        msg_id = str(uuid.uuid4())

        payload = {
            "id": msg_id,
            "session_id": session_id,
            "user_id": user_id,
            "role": data.role,
            "content": data.content,
            "metadata": data.metadata or {},
            "created_at": now_iso,
        }

        if client:
            try:
                res = client.table("conversation_messages").insert(payload).execute()
                # Touch updated_at on session
                client.table("conversation_sessions").update({"updated_at": now_iso}).eq("id", session_id).execute()
                if res and res.data and len(res.data) > 0:
                    r = res.data[0]
                    return ConversationMessageResponse(
                        id=r["id"],
                        session_id=r["session_id"],
                        user_id=r["user_id"],
                        role=r["role"],
                        content=r["content"],
                        metadata=r.get("metadata") or {},
                        created_at=r["created_at"],
                    )
            except Exception as e:
                logger.warning(f"Supabase create_message failed: {e}")

        if session_id not in _in_memory_messages:
            _in_memory_messages[session_id] = []
        _in_memory_messages[session_id].append(payload)

        # Update in-memory session updated_at
        user_sessions = _in_memory_sessions.get(user_id, [])
        for s in user_sessions:
            if s["id"] == session_id:
                s["updated_at"] = now_iso
                break

        return ConversationMessageResponse(**payload)

    async def get_messages(
        self, user_id: str, session_id: str, limit: int = 50
    ) -> List[ConversationMessageResponse]:
        client = self._get_client()

        if client:
            try:
                res = (
                    client.table("conversation_messages")
                    .select("*")
                    .eq("session_id", session_id)
                    .eq("user_id", user_id)
                    .order("created_at", desc=False)
                    .limit(limit)
                    .execute()
                )
                return [
                    ConversationMessageResponse(
                        id=r["id"],
                        session_id=r["session_id"],
                        user_id=r["user_id"],
                        role=r["role"],
                        content=r["content"],
                        metadata=r.get("metadata") or {},
                        created_at=r["created_at"],
                    )
                    for r in (res.data or [])
                ]
            except Exception as e:
                logger.warning(f"Supabase get_messages failed: {e}")

        msgs = _in_memory_messages.get(session_id, [])
        return [ConversationMessageResponse(**m) for m in msgs[:limit]]


conversation_repository = ConversationRepository()

