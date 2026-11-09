from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class JournalCreateRequest(BaseModel):
    title: Optional[str] = Field(default="Voice Reflection", max_length=120)
    transcript: str = Field(min_length=1, max_length=15000, description="Transcribed and user-edited text")
    mood_tag: Optional[str] = Field(default=None, max_length=50)
    duration_seconds: Optional[int] = Field(default=0, ge=0)
    reflection: Optional[str] = Field(default=None, description="Optional AI-generated reflection saved alongside")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Non-sensitive metadata e.g. source")


class JournalUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    transcript: Optional[str] = Field(default=None, min_length=1, max_length=15000)
    mood_tag: Optional[str] = Field(default=None, max_length=50)
    reflection: Optional[str] = None


class JournalResponse(BaseModel):
    id: str
    user_id: str
    title: str
    transcript: str
    mood_tag: Optional[str] = None
    duration_seconds: int = 0
    reflection: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class JournalListResponse(BaseModel):
    items: List[JournalResponse]
    total: int


class JournalReflectionRequest(BaseModel):
    transcript: str = Field(min_length=3, max_length=15000)


class JournalReflectionResponse(BaseModel):
    reflection: str = Field(description="Warm, grounded reflection without unsolicited advice")
    is_crisis_override: bool = Field(default=False, description="True if input triggered safety crisis screening")

