from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

RoleType = Literal["user", "assistant", "system"]


class ConversationSessionCreate(BaseModel):
    """Schema for creating a new conversation session."""
    title: Optional[str] = Field(default=None, max_length=150, description="Optional title or theme")


class ConversationSessionResponse(BaseModel):
    """Schema for a conversation session."""
    id: str
    user_id: str
    title: Optional[str] = None
    created_at: str
    updated_at: str
    archived_at: Optional[str] = None
    message_count: int = 0


class ConversationMessageCreate(BaseModel):
    """Schema for persisting an individual message."""
    role: RoleType
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConversationMessageResponse(BaseModel):
    """Schema for an individual conversation message."""
    id: str
    session_id: str
    user_id: str
    role: RoleType
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ChatStreamRequest(BaseModel):
    """Schema for sending a chat message to the streaming assistant."""
    content: str = Field(min_length=1, max_length=2000, description="User's reflection or message")
    session_id: Optional[str] = Field(default=None, description="Existing session ID, or null to auto-create")

