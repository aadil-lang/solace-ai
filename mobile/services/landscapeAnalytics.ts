import {
  CheckIn,
  MoodType,
  TimeOfDay,
  SeasonDistributionItem,
  LandscapeSummary,
} from '@/types';

export const MOOD_METADATA: Record<MoodType, { label: string; color: string }> = {
  peaceful: { label: 'Peaceful', color: '#4E7A58' },
  grateful: { label: 'Grateful', color: '#D48C46' },
  reflective: { label: 'Reflective', color: '#52796F' },
  anxious: { label: 'Anxious', color: '#8F5D5D' },
  heavy: { label: 'Heavy', color: '#68707A' },
  hopeful: { label: 'Hopeful', color: '#B5835A' },
};

export const MOOD_ORDER: MoodType[] = [
  'peaceful',
  'grateful',
  'reflective',
  'anxious',
  'heavy',
  'hopeful',
];

/**
 * Classify a date into local time-of-day window.
 * Morning:   05:00 - 11:59
 * Afternoon: 12:00 - 16:59
 * Evening:   17:00 - 21:59
 * Night:     22:00 - 04:59
 */
export function classifyTimeOfDay(date: Date, timeZone?: string): TimeOfDay {
  let hour = date.getHours();
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const hourPart = parts.find((p) => p.type === 'hour');
      if (hourPart) {
        hour = parseInt(hourPart.value, 10);
      }
    } catch {
      hour = date.getHours();
    }
  }

  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Filter check-ins by timeframe in milliseconds.
 */
export function filterCheckInsByTimeframe(
  checkIns: CheckIn[],
  timeframe: '7d' | '30d' | 'all',
  referenceDate: Date = new Date()
): CheckIn[] {
  if (timeframe === 'all' || !checkIns.length) {
    return checkIns;
  }

  const days = timeframe === '7d' ? 7 : 30;
  const cutoffTime = referenceDate.getTime() - days * 24 * 60 * 60 * 1000;

  return checkIns.filter((c) => {
    const t = new Date(c.created_at).getTime();
    return t >= cutoffTime;
  });
}

/**
 * Compute deterministic landscape summary for a set of check-ins.
 * Strictly parity-matched with backend `landscape_service.calculate_summary`.
 */
export function computeLandscapeSummary(
  checkIns: CheckIn[],
  timeframe: '7d' | '30d' | 'all' = '7d',
  timeZone?: string,
  referenceDate: Date = new Date()
): LandscapeSummary {
  const scoped = filterCheckInsByTimeframe(checkIns, timeframe, referenceDate);
  const total = scoped.length;

  // 1. Empty state: strictly null averages and dominants
  if (total === 0) {
    const emptyDist: SeasonDistributionItem[] = MOOD_ORDER.map((m) => ({
      mood: m,
      label: MOOD_METADATA[m].label,
      count: 0,
      percentage: 0.0,
      color: MOOD_METADATA[m].color,
    }));

    return {
      timeframe,
      total_moments: 0,
      season_distribution: emptyDist,
      dominant_season: null,
      average_intensity: null,
      meaningful_moments_count: 0,
      busiest_time_of_day: null,
    };
  }

  // 2. Count tallies & latest timestamps for deterministic tie-breaking
  const moodCounts: Record<MoodType, number> = {
    peaceful: 0,
    grateful: 0,
    reflective: 0,
    anxious: 0,
    heavy: 0,
    hopeful: 0,
  };
  const moodLatestTs: Partial<Record<MoodType, number>> = {};
  let intensitySum = 0;
  let meaningfulCount = 0;

  const todCounts: Record<TimeOfDay, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };
  const todLatestTs: Partial<Record<TimeOfDay, number>> = {};

  for (const c of scoped) {
    const cTime = new Date(c.created_at).getTime();
    if (moodCounts[c.mood] !== undefined) {
      moodCounts[c.mood] += 1;
      if (!moodLatestTs[c.mood] || cTime > (moodLatestTs[c.mood] || 0)) {
        moodLatestTs[c.mood] = cTime;
      }
    }

    intensitySum += c.intensity;

    if (c.is_meaningful) {
      meaningfulCount += 1;
    }

    const tod = classifyTimeOfDay(new Date(c.created_at), timeZone);
    todCounts[tod] += 1;
    if (!todLatestTs[tod] || cTime > (todLatestTs[tod] || 0)) {
      todLatestTs[tod] = cTime;
    }
  }

  // 3. Distribution percentages
  const distribution: SeasonDistributionItem[] = MOOD_ORDER.map((m) => {
    const cnt = moodCounts[m];
    const pct = Math.round((cnt / total) * 1000) / 10;
    return {
      mood: m,
      label: MOOD_METADATA[m].label,
      count: cnt,
      percentage: pct,
      color: MOOD_METADATA[m].color,
    };
  });

  // 4. Dominant season with tie-break by latest timestamp
  const maxMoodCount = Math.max(...Object.values(moodCounts));
  const dominantCandidates = MOOD_ORDER.filter((m) => moodCounts[m] === maxMoodCount);
  let dominantSeason: MoodType = dominantCandidates[0];
  if (dominantCandidates.length > 1) {
    dominantSeason = dominantCandidates.reduce((best, curr) => {
      const bestTs = moodLatestTs[best] || 0;
      const currTs = moodLatestTs[curr] || 0;
      return currTs > bestTs ? curr : best;
    }, dominantCandidates[0]);
  }

  // 5. Average intensity (1.0 to 5.0)
  const averageIntensity = Math.round((intensitySum / total) * 10) / 10;

  // 6. Busiest time of day with tie-break by latest timestamp
  const todKeys: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
  const maxTodCount = Math.max(...todKeys.map((k) => todCounts[k]));
  const busiestCandidates = todKeys.filter((k) => todCounts[k] === maxTodCount);
  let busiestTod: TimeOfDay = busiestCandidates[0];
  if (busiestCandidates.length > 1) {
    busiestTod = busiestCandidates.reduce((best, curr) => {
      const bestTs = todLatestTs[best] || 0;
      const currTs = todLatestTs[curr] || 0;
      return currTs > bestTs ? curr : best;
    }, busiestCandidates[0]);
  }

  return {
    timeframe,
    total_moments: total,
    season_distribution: distribution,
    dominant_season: dominantSeason,
    average_intensity: averageIntensity,
    meaningful_moments_count: meaningfulCount,
    busiest_time_of_day: busiestTod,
  };
}

