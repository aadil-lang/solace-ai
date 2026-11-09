-- ==============================================================================
-- SOLACE AI — MIGRATION 00005: Voice Journal (Private Audio Journaling)
-- Target: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

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

-- Indexes for efficient retrieval by user and recency
CREATE INDEX IF NOT EXISTS idx_voice_journals_user_created ON public.voice_journals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_journals_created_at ON public.voice_journals(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.voice_journals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_journals' AND policyname = 'Users can view own journals') THEN
        CREATE POLICY "Users can view own journals" ON public.voice_journals FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_journals' AND policyname = 'Users can insert own journals') THEN
        CREATE POLICY "Users can insert own journals" ON public.voice_journals FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_journals' AND policyname = 'Users can update own journals') THEN
        CREATE POLICY "Users can update own journals" ON public.voice_journals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_journals' AND policyname = 'Users can delete own journals') THEN
        CREATE POLICY "Users can delete own journals" ON public.voice_journals FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Automatic updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_voice_journals_updated_at') THEN
        CREATE TRIGGER set_voice_journals_updated_at
            BEFORE UPDATE ON public.voice_journals
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

