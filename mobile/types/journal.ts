export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  transcript: string;
  mood_tag?: string | null;
  duration_seconds: number;
  reflection?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface JournalCreateInput {
  title?: string;
  transcript: string;
  mood_tag?: string;
  duration_seconds?: number;
  reflection?: string;
  metadata?: Record<string, any>;
}

export interface JournalUpdateInput {
  title?: string;
  transcript?: string;
  mood_tag?: string;
  reflection?: string;
}

export interface JournalReflectionResponse {
  reflection: string;
  is_crisis_override?: boolean;
}

export interface JournalListResponse {
  items: JournalEntry[];
  total: number;
}
