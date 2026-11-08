from typing import List, Optional
from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    """Schema for returning user profile details."""
    id: str = Field(description="Unique UUID of the user matching auth.users")
    email: Optional[str] = Field(default=None, description="User email address")
    display_name: Optional[str] = Field(default=None, description="Full or display name")
    preferred_name: Optional[str] = Field(default=None, description="Preferred name or greeting")
    avatar_url: Optional[str] = Field(default=None, description="URL of user profile photo")
    onboarding_completed: bool = Field(default=False, description="Whether onboarding questionnaire has been completed")
    wellness_goals: List[str] = Field(default_factory=list, description="Selected wellness goals")
    interaction_style: Optional[str] = Field(default=None, description="Preferred tone/style of AI companion")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "11111111-2222-3333-4444-555555555555",
                "email": "user@example.com",
                "display_name": "Aadil Rahman",
                "preferred_name": "Aadil",
                "avatar_url": None,
                "onboarding_completed": True,
                "wellness_goals": ["Stress reduction", "Better sleep"],
                "interaction_style": "gentle",
                "created_at": "2026-11-08T15:00:00Z",
                "updated_at": "2026-11-08T15:05:00Z"
            }
        }


class ProfileUpdate(BaseModel):
    """Schema for updating user profile fields."""
    display_name: Optional[str] = Field(default=None, max_length=100)
    preferred_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    onboarding_completed: Optional[bool] = Field(default=None)
    wellness_goals: Optional[List[str]] = Field(default=None)
    interaction_style: Optional[str] = Field(default=None, max_length=50)

