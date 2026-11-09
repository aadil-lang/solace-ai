# Solace AI — Feature Contracts & API Specifications

This document defines the strict Pydantic v2 backend schemas, TypeScript client interfaces, and PostgreSQL database schemas for all five platform capabilities.

---

## 1. Words of Solace (Multilingual Poetry)

### 1.1 Backend Pydantic Schemas (`backend/app/schemas/poetry.py`)

```python
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class PoetryFormat(str, Enum):
    ENGLISH = "english"
    URDU_NASTALIQ = "urdu_nastaliq"
    BILINGUAL = "bilingual"
    ROMAN_URDU = "roman_urdu"

class PoetryTheme(str, Enum):
    OVERWHELMED = "overwhelmed"
    RESILIENCE = "resilience"
    PATIENCE = "patience"
    SELF_RELIANCE = "self_reliance"
    HOPE = "hope"
    GROWTH = "growth"
    UNDERSTOOD = "understood"
    MOMENT_OF_CALM = "moment_of_calm"

class PoetryGenerateRequest(BaseModel):
    format: PoetryFormat = Field(default=PoetryFormat.ENGLISH, description="Requested poetic format and script")
    theme: PoetryTheme = Field(default=PoetryTheme.MOMENT_OF_CALM, description="Core emotional theme")
    context: Optional[str] = Field(default=None, max_length=300, description="Optional brief context from user")

class PoetryGenerateResponse(BaseModel):
    title: str = Field(description="Title of the poem")
    lines: List[str] = Field(description="Primary poetic stanzas")
    secondary_lines: Optional[List[str]] = Field(default=None, description="Translation lines if bilingual format")
    reflection: str = Field(description="Grounded 1-2 sentence mindful closing thought")
    format: PoetryFormat
    theme: PoetryTheme
    is_crisis: bool = Field(default=False, description="Whether crisis safety was triggered")

class SavedPoemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    format: PoetryFormat
    theme: PoetryTheme
    secondary_content: Optional[str] = None
    reflection: Optional[str] = None
    metadata: Optional[dict] = Field(default_factory=dict)

class SavedPoemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    format: PoetryFormat
    theme: PoetryTheme
    secondary_content: Optional[str] = None
    reflection: Optional[str] = None
    metadata: dict
    created_at: str

class SavedPoemListResponse(BaseModel):
    items: List[SavedPoemResponse]
    total: int
```

### 1.2 TypeScript Interfaces (`mobile/types/poetry.ts`)

```typescript
export type PoetryFormat = 'english' | 'urdu_nastaliq' | 'bilingual' | 'roman_urdu';
export type PoetryTheme = 
  | 'overwhelmed' 
  | 'resilience' 
  | 'patience' 
  | 'self_reliance' 
  | 'hope' 
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
  secondary_lines?: string[];
  reflection: string;
  format: PoetryFormat;
  theme: PoetryTheme;
}

export interface SavedPoem {
  id: string;
  user_id: string;
  title: string;
  content: string;
  format: PoetryFormat;
  theme: PoetryTheme;
  metadata?: Record<string, any>;
  created_at: string;
}
```

---

## 2. Voice Journal (Private Audio Journaling)

### 2.1 Backend Pydantic Schemas (`backend/app/schemas/journal.py`)

```python
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class JournalCreateRequest(BaseModel):
    title: Optional[str] = Field(default="Voice Reflection", max_length=100)
    transcript: str = Field(min_length=1, max_length=10000, description="Transcribed and user-edited text")
    mood_tag: Optional[str] = Field(default=None, max_length=30)
    duration_seconds: Optional[int] = Field(default=0, ge=0)
    reflection: Optional[str] = Field(default=None, description="Optional AI-generated reflection saved alongside")

class JournalUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    transcript: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    mood_tag: Optional[str] = None

class JournalResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    transcript: str
    mood_tag: Optional[str]
    duration_seconds: int
    reflection: Optional[str]
    created_at: datetime
    updated_at: datetime

class JournalReflectionRequest(BaseModel):
    transcript: str = Field(min_length=5, max_length=5000)

class JournalReflectionResponse(BaseModel):
    reflection: str = Field(description="A warm, grounded, 2-3 sentence reflection on the journal entry without unsolicited advice")
```

### 2.2 TypeScript Interfaces (`mobile/types/journal.ts`)

```typescript
export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  transcript: string;
  mood_tag?: string | null;
  duration_seconds: number;
  reflection?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalCreateInput {
  title?: string;
  transcript: string;
  mood_tag?: string;
  duration_seconds?: number;
  reflection?: string;
}

export interface JournalReflectionResponse {
  reflection: string;
}
```

---

## 3. Emotional Landscape (Visual Mood Sanctuary)

### 3.1 Backend Pydantic Schemas (`backend/app/schemas/landscape.py`)

```python
from typing import List
from pydantic import BaseModel, Field

class LandscapeThemeConfig(BaseModel):
    mood: str
    primary_color: str
    secondary_color: str
    ambient_gradient: List[str]
    particle_count: int = Field(ge=5, le=50)
    ambient_speed: float = Field(ge=0.1, le=2.0)
    soundscape_hint: str
    sanctuary_title: str
    affirmation: str

class LandscapeStateResponse(BaseModel):
    available_moods: List[str]
    theme_configs: dict[str, LandscapeThemeConfig]
```

### 3.2 TypeScript Interfaces (`mobile/types/landscape.ts`)

```typescript
export interface LandscapeThemeConfig {
  mood: string;
  primary_color: string;
  secondary_color: string;
  ambient_gradient: string[];
  particle_count: number;
  ambient_speed: number;
  soundscape_hint: string;
  sanctuary_title: string;
  affirmation: string;
}
```

---

## 4. Holistic Wellbeing (Everyday Suggestions)

### 4.1 Backend Pydantic Schemas (`backend/app/schemas/wellbeing.py`)

```python
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class SuggestionCategory(str, Enum):
    GENTLE_MOVEMENT = "gentle_movement"
    HYDRATION = "hydration"
    MINDFUL_REST = "mindful_rest"
    BREATH_PAUSE = "breath_pause"
    SCREEN_BREAK = "screen_break"
    BALANCED_NOURISHMENT = "balanced_nourishment"

class WellbeingSuggestion(BaseModel):
    id: str
    category: SuggestionCategory
    title: str
    summary: str
    rationale: str
    action_type: str = Field(description="dismiss | start_breathing | open_journal | acknowledge")
    duration_minutes: Optional[int] = None

class WellbeingSuggestionsResponse(BaseModel):
    suggestions: List[WellbeingSuggestion]
    disclaimer: str = "These suggestions are gentle wellness invitations, not medical or psychological advice."

class SuggestionDismissRequest(BaseModel):
    suggestion_id: str
    category: SuggestionCategory
    reason: Optional[str] = None
```

### 4.2 TypeScript Interfaces (`mobile/types/wellbeing.ts`)

```typescript
export type SuggestionCategory = 
  | 'gentle_movement'
  | 'hydration'
  | 'mindful_rest'
  | 'breath_pause'
  | 'screen_break'
  | 'balanced_nourishment';

export interface WellbeingSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  summary: string;
  rationale: string;
  action_type: 'dismiss' | 'start_breathing' | 'open_journal' | 'acknowledge';
  duration_minutes?: number;
}
```

---

## 5. Database Schema & RLS Migrations (`database/migrations/00004_platform_expansion.sql`)

```sql
-- Migration 00004: Words of Solace, Voice Journals, and Holistic Wellbeing

-- 1. Words of Solace (Saved Poems)
CREATE TABLE IF NOT EXISTS public.words_of_solace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'english',
    theme TEXT NOT NULL DEFAULT 'moment_of_calm',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_words_of_solace_user_id ON public.words_of_solace(user_id);
ALTER TABLE public.words_of_solace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved poems" ON public.words_of_solace
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Migration 00005: Voice Journals (Private Audio Journaling)
-- Table: public.voice_journals
CREATE TABLE IF NOT EXISTS public.voice_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Voice Reflection',
    transcript TEXT NOT NULL,
    mood_tag TEXT,
    duration_seconds INT DEFAULT 0,
    reflection TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_journals_user_created ON public.voice_journals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_journals_created_at ON public.voice_journals(created_at DESC);
ALTER TABLE public.voice_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journals" ON public.voice_journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journals" ON public.voice_journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journals" ON public.voice_journals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own journals" ON public.voice_journals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_voice_journals_updated_at
    BEFORE UPDATE ON public.voice_journals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Holistic Wellbeing (Dismissal history and preferences)
CREATE TABLE IF NOT EXISTS public.wellbeing_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    suggestion_id TEXT NOT NULL,
    category TEXT NOT NULL,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_dismissals_user ON public.wellbeing_dismissals(user_id, category);
ALTER TABLE public.wellbeing_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dismissals" ON public.wellbeing_dismissals
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

