/**
 * Global type definitions for Solace AI Mobile
 */

export type ConnectionStatus = 'idle' | 'loading' | 'connected' | 'disconnected';

export interface BackendHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp?: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  wellness_goals?: string[];
  interaction_style?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfileUpdate {
  preferred_name?: string;
  display_name?: string;
  avatar_url?: string;
  onboarding_completed?: boolean;
  wellness_goals?: string[];
  interaction_style?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  isGuest: boolean;
}

// Phase 3: Mood Check-ins
export type MoodType = 'peaceful' | 'grateful' | 'reflective' | 'anxious' | 'heavy' | 'hopeful';

export interface CheckIn {
  id: string;
  user_id: string;
  mood: MoodType;
  intensity: number; // 1-5
  note?: string | null;
  is_meaningful?: boolean;
  sync_status?: 'synced' | 'pending_sync' | 'local_only';
  created_at: string;
}

export interface CheckInCreate {
  mood: MoodType;
  intensity: number;
  note?: string | null;
  is_meaningful?: boolean;
  created_at?: string;
}

export interface CheckInHistoryResponse {
  items: CheckIn[];
  total: number;
}

// Phase 4: Emotional Landscape
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type TimeframeType = '7d' | '30d' | 'all' | 'moment';

export interface SeasonDistributionItem {
  mood: MoodType;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface LandscapeSummary {
  timeframe: '7d' | '30d' | 'all';
  total_moments: number;
  season_distribution: SeasonDistributionItem[];
  dominant_season: MoodType | null;
  average_intensity: number | null;
  meaningful_moments_count: number;
  busiest_time_of_day: TimeOfDay | null;
}

export interface LandscapeReflectionResponse {
  reflection: string;
  is_crisis_override: boolean;
  dominant_season?: string | null;
}

export interface LandscapeReflectionRecord {
  id: string;
  user_id: string;
  timeframe: string;
  reflection: string;
  dominant_mood?: string | null;
  created_at: string;
}

export interface MoodOption {
  id: MoodType;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// Phase 3: Conversation Sessions & Messages
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ConversationSession {
  id: string;
  user_id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  message_count?: number;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
  isStreaming?: boolean;
}

// Phase 3: Consent-Based Emotional Memory
export type MemoryCategory =
  | 'preferences'
  | 'goals'
  | 'ongoing_challenges'
  | 'relationships'
  | 'coping_strategies'
  | 'important_context';

export type ConsentStatus = 'approved' | 'pending' | 'declined';

export interface UserMemory {
  id: string;
  user_id: string;
  memory_text: string;
  category: MemoryCategory;
  source: 'conversation' | 'check_in' | 'user_created';
  consent_status: ConsentStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemorySuggestion {
  memory_text: string;
  category: MemoryCategory;
  prompt: string;
}

export interface MemoryCreate {
  memory_text: string;
  category: MemoryCategory;
  source?: 'conversation' | 'check_in' | 'user_created';
  consent_status?: ConsentStatus;
}

export interface MemoryUpdate {
  memory_text?: string;
  category?: MemoryCategory;
  is_active?: boolean;
}

export interface WellnessActivity {
  id: string;
  title: string;
  category: 'breathing' | 'journaling' | 'grounding';
  duration: string;
  description: string;
  icon: string;
}

export * from './poetry';
export * from './journal';
