from typing import List, Optional, Literal
from pydantic import BaseModel, Field

MoodType = Literal["peaceful", "grateful", "reflective", "anxious", "heavy", "hopeful"]


class CheckInCreate(BaseModel):
    """Schema for recording a new mood check-in."""
    mood: MoodType = Field(description="Selected emotional state")
    intensity: int = Field(ge=1, le=5, description="Perceived intensity from 1 (subtle) to 5 (overwhelming)")
    note: Optional[str] = Field(default=None, max_length=500, description="Optional brief note on context or feelings")


class CheckInResponse(BaseModel):
    """Schema for a recorded check-in."""
    id: str
    user_id: str
    mood: MoodType
    intensity: int
    note: Optional[str] = None
    created_at: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
                "user_id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
                "mood": "reflective",
                "intensity": 3,
                "note": "Taking a moment after a busy morning.",
                "created_at": "2026-11-08T15:30:00Z"
            }
        }


class CheckInHistoryResponse(BaseModel):
    """Paginated or chronological check-in history response."""
    items: List[CheckInResponse]
    total: int

