from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class PoetryFormat(str, Enum):
    ENGLISH = "english"
    URDU_NASTALIQ = "urdu_nastaliq"
    BILINGUAL = "bilingual"
    ROMAN_URDU = "roman_urdu"


class PoetryTheme(str, Enum):
    RESILIENCE = "resilience"
    PATIENCE = "patience"
    HOPE = "hope"
    SELF_RELIANCE = "self_reliance"
    OVERWHELMED = "overwhelmed"
    GROWTH = "growth"
    UNDERSTOOD = "understood"
    MOMENT_OF_CALM = "moment_of_calm"


class PoetryGenerateRequest(BaseModel):
    format: PoetryFormat = Field(default=PoetryFormat.ENGLISH, description="Requested poetic format and script")
    theme: PoetryTheme = Field(default=PoetryTheme.MOMENT_OF_CALM, description="Core emotional theme")
    context: Optional[str] = Field(default=None, max_length=300, description="Optional brief context from user")


class PoetryGenerateResponse(BaseModel):
    title: str = Field(description="Title of the poem")
    lines: List[str] = Field(description="Primary poetic lines/stanzas")
    secondary_lines: Optional[List[str]] = Field(default=None, description="Translation/secondary lines if bilingual")
    reflection: str = Field(description="Grounded 1-2 sentence mindful closing thought")
    format: PoetryFormat
    theme: PoetryTheme
    is_crisis: bool = Field(default=False, description="Whether crisis safety was triggered")


class SavedPoemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    format: PoetryFormat = Field(default=PoetryFormat.ENGLISH)
    theme: PoetryTheme = Field(default=PoetryTheme.MOMENT_OF_CALM)
    secondary_content: Optional[str] = None
    reflection: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SavedPoemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    format: PoetryFormat
    theme: PoetryTheme
    secondary_content: Optional[str] = None
    reflection: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class SavedPoemListResponse(BaseModel):
    items: List[SavedPoemResponse]
    total: int

