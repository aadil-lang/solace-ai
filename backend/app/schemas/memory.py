from typing import List, Optional, Literal
from pydantic import BaseModel, Field

MemoryCategory = Literal[
    "preferences",
    "goals",
    "ongoing_challenges",
    "relationships",
    "coping_strategies",
    "important_context"
]

ConsentStatus = Literal["approved", "pending", "declined"]
MemorySource = Literal["conversation", "check_in", "user_created"]


class MemoryCreate(BaseModel):
    """Schema for creating a user-approved emotional memory."""
    memory_text: str = Field(min_length=3, max_length=500, description="Extracted or user-defined insight to remember")
    category: MemoryCategory = Field(default="important_context")
    source: MemorySource = Field(default="user_created")
    consent_status: ConsentStatus = Field(default="approved")


class MemoryUpdate(BaseModel):
    """Schema for editing or disabling an emotional memory."""
    memory_text: Optional[str] = Field(default=None, max_length=500)
    category: Optional[MemoryCategory] = Field(default=None)
    is_active: Optional[bool] = Field(default=None, description="Toggle whether this memory is used in AI companion context")


class MemoryResponse(BaseModel):
    """Schema for returning a stored emotional memory."""
    id: str
    user_id: str
    memory_text: str
    category: MemoryCategory
    source: MemorySource
    consent_status: ConsentStatus
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": "m1a2b3c4-d5e6-7890-abcd-ef1234567890",
                "user_id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
                "memory_text": "Prefers breathing exercises when feeling tense before meetings.",
                "category": "coping_strategies",
                "source": "conversation",
                "consent_status": "approved",
                "is_active": True,
                "created_at": "2026-11-08T15:00:00Z",
                "updated_at": "2026-11-08T15:00:00Z"
            }
        }


class MemoryListResponse(BaseModel):
    """List of user memories."""
    items: List[MemoryResponse]
    total: int

