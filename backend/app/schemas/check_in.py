from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict, field_validator

MoodType = Literal["peaceful", "grateful", "reflective", "anxious", "heavy", "hopeful"]
TimeOfDay = Literal["morning", "afternoon", "evening", "night"]
TimeframeType = Literal["7d", "30d", "all", "moment"]


class CheckInCreate(BaseModel):
    """Schema for recording a new mood check-in."""
    model_config = ConfigDict(extra="forbid")

    mood: MoodType = Field(description="Selected emotional state")
    intensity: int = Field(ge=1, le=5, description="Perceived intensity from 1 (subtle) to 5 (overwhelming)")
    note: Optional[str] = Field(default=None, max_length=500, description="Optional brief note on context or feelings")
    is_meaningful: bool = Field(default=False, description="Whether explicitly marked as meaningful at creation")
    created_at: Optional[str] = Field(default=None, description="Optional ISO timestamp to preserve offline creation time")

    @field_validator("created_at")
    @classmethod
    def validate_created_at(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        try:
            clean_ts = v.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
        except Exception as e:
            raise ValueError(f"created_at must be a valid ISO 8601 timestamp string: {e}")

        # Reject timestamps more than 5 minutes in the future
        max_future = datetime.now(timezone.utc) + timedelta(minutes=5)
        if dt > max_future:
            raise ValueError("created_at cannot be in the future beyond acceptable 5-minute clock drift")

        return v


class CheckInResponse(BaseModel):
    """Schema for a recorded check-in."""
    model_config = ConfigDict(extra="ignore")

    id: str
    user_id: str
    mood: MoodType
    intensity: int
    note: Optional[str] = None
    is_meaningful: bool = False
    created_at: str


class CheckInHistoryResponse(BaseModel):
    """Paginated or chronological check-in history response."""
    items: List[CheckInResponse]
    total: int


class CheckInMeaningfulUpdate(BaseModel):
    """Strict schema allowing ONLY is_meaningful mutation."""
    model_config = ConfigDict(extra="forbid")

    is_meaningful: bool = Field(description="Explicit user toggle for meaningful moment bookmark")


class SeasonDistributionItem(BaseModel):
    """Proportion and count of a mood category within a timeframe."""
    mood: MoodType
    label: str
    count: int
    percentage: float = Field(ge=0.0, le=100.0, description="Percentage of total check-ins")
    color: str


class LandscapeSummaryResponse(BaseModel):
    """Deterministic non-clinical landscape summary for an emotional journey."""
    timeframe: str
    total_moments: int
    season_distribution: List[SeasonDistributionItem]
    dominant_season: Optional[MoodType] = None
    average_intensity: Optional[float] = None
    meaningful_moments_count: int
    busiest_time_of_day: Optional[TimeOfDay] = None


class LandscapeReflectionRequest(BaseModel):
    """Request for generating a contemplative non-clinical AI reflection."""
    model_config = ConfigDict(extra="ignore")

    timeframe: TimeframeType = Field(default="7d", description="Target timeframe or moment scope")
    check_in_ids: Optional[List[str]] = Field(default=None, description="Optional explicit IDs to scope reflection")
    selected_check_ins: Optional[List[CheckInResponse]] = Field(
        default=None, description="Directly provided check-ins for privacy-first ephemeral scoping"
    )


class LandscapeReflectionResponse(BaseModel):
    """Contemplative non-clinical reflection generated on selected moments."""
    reflection: str
    is_crisis_override: bool = False
    dominant_season: Optional[str] = None


class LandscapeReflectionCreate(BaseModel):
    """Explicit user-consented save request for a generated reflection."""
    model_config = ConfigDict(extra="forbid")

    timeframe: TimeframeType
    reflection: str = Field(min_length=1, max_length=2000)
    dominant_mood: Optional[str] = None


class LandscapeReflectionRecord(BaseModel):
    """Durable record of a user-saved landscape reflection."""
    id: str
    user_id: str
    timeframe: str
    reflection: str
    dominant_mood: Optional[str] = None
    created_at: str


class LandscapeReflectionsListResponse(BaseModel):
    """List of user-saved reflections."""
    items: List[LandscapeReflectionRecord]
    total: int
