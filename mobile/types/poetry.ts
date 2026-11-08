export type PoetryFormat = 'english' | 'urdu_nastaliq' | 'bilingual' | 'roman_urdu';

export type PoetryTheme =
  | 'resilience'
  | 'patience'
  | 'hope'
  | 'self_reliance'
  | 'overwhelmed'
  | 'growth'
  | 'understood'
  | 'moment_of_calm';

export interface PoetryGenerateRequest {
  format: PoetryFormat;
  theme: PoetryTheme;
  context?: string;
}

export interface PoetryGenerateResponse {
  title: string;
  lines: string[];
  secondary_lines?: string[] | null;
  reflection: string;
  format: PoetryFormat;
  theme: PoetryTheme;
  is_crisis?: boolean;
}

export interface SavedPoemCreate {
  title: string;
  content: string;
  format: PoetryFormat;
  theme: PoetryTheme;
  secondary_content?: string | null;
  reflection?: string | null;
  metadata?: Record<string, any>;
}

export interface SavedPoem {
  id: string;
  user_id: string;
  title: string;
  content: string;
  format: PoetryFormat;
  theme: PoetryTheme;
  secondary_content?: string | null;
  reflection?: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SavedPoemListResponse {
  items: SavedPoem[];
  total: number;
}
