import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone, timedelta
import zoneinfo
from app.schemas.check_in import (
    CheckInResponse,
    LandscapeSummaryResponse,
    SeasonDistributionItem,
    LandscapeReflectionRequest,
    LandscapeReflectionResponse,
    MoodType,
    TimeOfDay,
)
from app.services.ai_provider import get_ai_provider
from app.services.memory_service import memory_service, get_crisis_response

logger = logging.getLogger("solace.landscape_service")

MOOD_METADATA: Dict[MoodType, Dict[str, str]] = {
    "peaceful": {"label": "Peaceful", "color": "#4E7A58"},
    "grateful": {"label": "Grateful", "color": "#D48C46"},
    "reflective": {"label": "Reflective", "color": "#52796F"},
    "anxious": {"label": "Anxious", "color": "#8F5D5D"},
    "heavy": {"label": "Heavy", "color": "#68707A"},
    "hopeful": {"label": "Hopeful", "color": "#B5835A"},
}

MOOD_ORDER: List[MoodType] = [
    "peaceful",
    "grateful",
    "reflective",
    "anxious",
    "heavy",
    "hopeful",
]

LANDSCAPE_REFLECTION_SYSTEM_PROMPT = (
    "You are Solace, a gentle, contemplative wellness sanctuary. "
    "The user has invited a reflection on their emotional landscape across recent check-ins.\n\n"
    "Guidelines:\n"
    "1. Keep your reflection brief, natural, and sincere: strictly 2 to 3 sentences.\n"
    "2. Acknowledge their recent emotional seasons with gentle warmth and curiosity.\n"
    "3. Frame emotions as natural passing weather rather than fixed conclusions or permanent states.\n"
    "4. Do NOT give advice, action steps, or telling the user what they 'should' do.\n"
    "5. Avoid toxic positivity, hollow cheer, and motivational cliches ('You can do it!').\n"
    "6. Absolutely NEVER provide psychological diagnoses, medical labels, or clinical severity assessments.\n"
    "7. Close with a grounded, non-pressuring observation."
)

FALLBACK_LANDSCAPE_REFLECTION = (
    "Every season carries its own rhythm and wisdom. "
    "Giving yourself permission to notice these inner shifts without needing to steer or fix them "
    "is a quiet act of kindness to yourself."
)


class LandscapeService:
    """Service providing deterministic timezone-aware analytics and safe contemplative reflections."""

    @staticmethod
    def get_user_zoneinfo(tz_name: Optional[str]):
        """Safely resolve IANA timezone string, falling back to timezone.utc if invalid or missing."""
        if not tz_name or tz_name.strip().upper() == "UTC":
            return timezone.utc
        try:
            return zoneinfo.ZoneInfo(tz_name.strip())
        except Exception:
            logger.warning(f"Invalid timezone identifier '{tz_name}', falling back to UTC")
            return timezone.utc

    @staticmethod
    def classify_time_of_day(local_dt: datetime) -> TimeOfDay:
        """Categorize local hour into morning, afternoon, evening, or night."""
        hour = local_dt.hour
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 17:
            return "afternoon"
        elif 17 <= hour < 22:
            return "evening"
        else:
            return "night"

    @staticmethod
    def parse_utc_timestamp(ts_str: str) -> datetime:
        """Parse ISO timestamp string to UTC-aware datetime."""
        clean_ts = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_ts)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def filter_by_timeframe(
        self,
        check_ins: List[CheckInResponse],
        timeframe: str,
        user_tz: zoneinfo.ZoneInfo,
        now_dt: Optional[datetime] = None,
    ) -> List[CheckInResponse]:
        """Filter check-ins based on local calendar timeframe boundaries."""
        if timeframe == "all" or not check_ins:
            return check_ins

        now_utc = now_dt if now_dt else datetime.now(timezone.utc)
        now_local = now_utc.astimezone(user_tz)

        if timeframe == "7d":
            cutoff_local = now_local - timedelta(days=7)
        elif timeframe == "30d":
            cutoff_local = now_local - timedelta(days=30)
        else:
            return check_ins

        cutoff_utc = cutoff_local.astimezone(timezone.utc)

        filtered = []
        for c in check_ins:
            c_utc = self.parse_utc_timestamp(c.created_at)
            if c_utc >= cutoff_utc:
                filtered.append(c)
        return filtered

    def calculate_summary(
        self,
        check_ins: List[CheckInResponse],
        timeframe: str = "7d",
        tz_name: Optional[str] = "UTC",
        now_dt: Optional[datetime] = None,
    ) -> LandscapeSummaryResponse:
        """Calculate deterministic, non-clinical landscape summary."""
        user_tz = self.get_user_zoneinfo(tz_name)
        scoped_check_ins = self.filter_by_timeframe(check_ins, timeframe, user_tz, now_dt)

        total_count = len(scoped_check_ins)

        # 1. Empty state handling: strictly null averages and dominants
        if total_count == 0:
            distribution = [
                SeasonDistributionItem(
                    mood=m,
                    label=MOOD_METADATA[m]["label"],
                    count=0,
                    percentage=0.0,
                    color=MOOD_METADATA[m]["color"],
                )
                for m in MOOD_ORDER
            ]
            return LandscapeSummaryResponse(
                timeframe=timeframe,
                total_moments=0,
                season_distribution=distribution,
                dominant_season=None,
                average_intensity=None,
                meaningful_moments_count=0,
                busiest_time_of_day=None,
            )

        # 2. Mood counts & most recent timestamps for tie-breaking
        mood_counts: Dict[MoodType, int] = {m: 0 for m in MOOD_ORDER}
        mood_latest_ts: Dict[MoodType, datetime] = {}
        intensity_sum = 0
        meaningful_count = 0
        time_of_day_counts: Dict[TimeOfDay, int] = {
            "morning": 0,
            "afternoon": 0,
            "evening": 0,
            "night": 0,
        }
        time_of_day_latest_ts: Dict[TimeOfDay, datetime] = {}

        for c in scoped_check_ins:
            # Mood counts
            if c.mood in mood_counts:
                mood_counts[c.mood] += 1
                c_utc = self.parse_utc_timestamp(c.created_at)
                if c.mood not in mood_latest_ts or c_utc > mood_latest_ts[c.mood]:
                    mood_latest_ts[c.mood] = c_utc

            # Intensity sum
            intensity_sum += c.intensity

            # Meaningful count
            if c.is_meaningful:
                meaningful_count += 1

            # Time of day in user's local timezone
            c_local = self.parse_utc_timestamp(c.created_at).astimezone(user_tz)
            tod = self.classify_time_of_day(c_local)
            time_of_day_counts[tod] += 1
            if tod not in time_of_day_latest_ts or c_local > time_of_day_latest_ts[tod]:
                time_of_day_latest_ts[tod] = c_local

        # 3. Distribution percentages
        distribution = []
        for m in MOOD_ORDER:
            cnt = mood_counts[m]
            pct = round((cnt / total_count) * 100.0, 1)
            distribution.append(
                SeasonDistributionItem(
                    mood=m,
                    label=MOOD_METADATA[m]["label"],
                    count=cnt,
                    percentage=pct,
                    color=MOOD_METADATA[m]["color"],
                )
            )

        # 4. Dominant season with tie-break by most recently logged
        max_count = max(mood_counts.values())
        dominant_candidates = [m for m, cnt in mood_counts.items() if cnt == max_count]
        if len(dominant_candidates) == 1:
            dominant_season = dominant_candidates[0]
        else:
            # Pick candidate with latest timestamp
            dominant_season = max(
                dominant_candidates,
                key=lambda m: mood_latest_ts.get(m, datetime.min.replace(tzinfo=timezone.utc)),
            )

        # 5. Average intensity (1.0 to 5.0)
        avg_intensity = round(intensity_sum / total_count, 1)

        # 6. Busiest time of day with tie-break
        max_tod_count = max(time_of_day_counts.values())
        busiest_candidates = [tod for tod, cnt in time_of_day_counts.items() if cnt == max_tod_count]
        if len(busiest_candidates) == 1:
            busiest_tod = busiest_candidates[0]
        else:
            busiest_tod = max(
                busiest_candidates,
                key=lambda tod: time_of_day_latest_ts.get(tod, datetime.min.replace(tzinfo=user_tz)),
            )

        return LandscapeSummaryResponse(
            timeframe=timeframe,
            total_moments=total_count,
            season_distribution=distribution,
            dominant_season=dominant_season,
            average_intensity=avg_intensity,
            meaningful_moments_count=meaningful_count,
            busiest_time_of_day=busiest_tod,
        )

    async def generate_reflection(
        self,
        request: LandscapeReflectionRequest,
        check_ins: List[CheckInResponse],
    ) -> LandscapeReflectionResponse:
        """Generate a gentle, non-clinical reflection on selected check-in moments."""
        # 1. Ephemeral scoping: only use check_ins specified
        target_check_ins = check_ins
        if request.check_in_ids:
            id_set = set(request.check_in_ids)
            target_check_ins = [c for c in check_ins if c.id in id_set]

        if not target_check_ins:
            return LandscapeReflectionResponse(
                reflection="Your landscape is open and quiet right now. Whenever you record check-ins, a reflection will gently emerge.",
                is_crisis_override=False,
                dominant_season=None,
            )

        # 2. Deterministic crisis screening on all user notes
        notes = [c.note.strip() for c in target_check_ins if c.note and c.note.strip()]
        combined_text = " ".join(notes)
        if combined_text and memory_service.is_crisis_input(combined_text):
            logger.warning("Landscape reflection request intercepted by deterministic crisis detection")
            crisis_text = get_crisis_response()
            return LandscapeReflectionResponse(
                reflection=crisis_text,
                is_crisis_override=True,
                dominant_season=None,
            )

        # 3. Build summary representation for AI prompt
        counts: Dict[str, int] = {}
        for c in target_check_ins:
            counts[c.mood] = counts.get(c.mood, 0) + 1
        dominant_mood = max(counts, key=counts.get) if counts else None

        distribution_summary = ", ".join(f"{mood}: {cnt}" for mood, cnt in counts.items())
        note_excerpts = ""
        if notes:
            note_excerpts = "Reflective notes from these moments:\n" + "\n".join(f'- "{n}"' for n in notes[:5])

        prompt = (
            f"Here is a summary of the user's emotional landscape over {request.timeframe}:\n"
            f"- Dominant season: {dominant_mood}\n"
            f"- Mood breakdown: {distribution_summary}\n"
            f"- Total moments: {len(target_check_ins)}\n\n"
            f"{note_excerpts}\n\n"
            "Please provide a 2 to 3 sentence gentle, non-clinical reflection."
        )

        try:
            provider = get_ai_provider()
            raw_response = await provider.generate_response(
                prompt=prompt,
                system_prompt=LANDSCAPE_REFLECTION_SYSTEM_PROMPT,
            )
            reflection_text = (raw_response or "").strip()
            if not reflection_text:
                reflection_text = FALLBACK_LANDSCAPE_REFLECTION

            return LandscapeReflectionResponse(
                reflection=reflection_text,
                is_crisis_override=False,
                dominant_season=dominant_mood,
            )
        except Exception as e:
            logger.warning(f"AI provider failed for landscape reflection, using fallback: {e}")
            return LandscapeReflectionResponse(
                reflection=FALLBACK_LANDSCAPE_REFLECTION,
                is_crisis_override=False,
                dominant_season=dominant_mood,
            )


landscape_service = LandscapeService()
