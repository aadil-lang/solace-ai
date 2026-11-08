import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.profile import ProfileResponse, ProfileUpdate

logger = logging.getLogger("solace.profile_repository")

# In-memory store for development/testing when Supabase DB is offline
_in_memory_profiles: Dict[str, Dict[str, Any]] = {}


class ProfileRepository:
    """Repository handling CRUD operations on the Supabase 'profiles' table."""

    @staticmethod
    def _get_client():
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                from app.services.supabase_client import get_supabase_client
                return get_supabase_client()
            except Exception as e:
                logger.warning(f"Could not connect to Supabase client: {e}")
        return None

    async def get_by_user_id(self, user_id: str, email: Optional[str] = None) -> ProfileResponse:
        client = self._get_client()

        if client:
            try:
                res = client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
                if res and res.data:
                    data = res.data
                    return ProfileResponse(
                        id=data["id"],
                        email=data.get("email") or email,
                        display_name=data.get("display_name"),
                        preferred_name=data.get("preferred_name"),
                        avatar_url=data.get("avatar_url"),
                        onboarding_completed=data.get("onboarding_completed", False),
                        wellness_goals=data.get("wellness_goals") or [],
                        interaction_style=data.get("interaction_style"),
                        created_at=data.get("created_at"),
                        updated_at=data.get("updated_at"),
                    )
            except Exception as e:
                logger.warning(f"Supabase query failed, falling back to local store: {e}")

        # In-memory fallback
        if user_id in _in_memory_profiles:
            data = _in_memory_profiles[user_id]
            return ProfileResponse(**data)

        # Create initial default profile if not found
        now = datetime.now(timezone.utc).isoformat()
        initial_name = email.split("@")[0] if email else "Friend"
        default_profile = {
            "id": user_id,
            "email": email,
            "display_name": initial_name,
            "preferred_name": initial_name,
            "avatar_url": None,
            "onboarding_completed": False,
            "wellness_goals": [],
            "interaction_style": None,
            "created_at": now,
            "updated_at": now,
        }
        _in_memory_profiles[user_id] = default_profile
        return ProfileResponse(**default_profile)

    async def update_by_user_id(self, user_id: str, updates: ProfileUpdate) -> ProfileResponse:
        client = self._get_client()
        update_dict = updates.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        if client:
            try:
                res = client.table("profiles").update(update_dict).eq("id", user_id).execute()
                if res and res.data and len(res.data) > 0:
                    data = res.data[0]
                    return ProfileResponse(
                        id=data["id"],
                        email=data.get("email"),
                        display_name=data.get("display_name"),
                        preferred_name=data.get("preferred_name"),
                        avatar_url=data.get("avatar_url"),
                        onboarding_completed=data.get("onboarding_completed", False),
                        wellness_goals=data.get("wellness_goals") or [],
                        interaction_style=data.get("interaction_style"),
                        created_at=data.get("created_at"),
                        updated_at=data.get("updated_at"),
                    )
            except Exception as e:
                logger.warning(f"Supabase update failed, updating local store: {e}")

        # Update in-memory profile
        current = await self.get_by_user_id(user_id)
        current_data = current.model_dump()
        current_data.update(update_dict)
        _in_memory_profiles[user_id] = current_data
        return ProfileResponse(**current_data)


profile_repository = ProfileRepository()

