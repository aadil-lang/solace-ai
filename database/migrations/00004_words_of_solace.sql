-- ==============================================================================
-- SOLACE AI — MIGRATION 00004: Words of Solace (Personalized Multilingual Poetry)
-- Target: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.words_of_solace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'english' CHECK (format IN (
        'english',
        'urdu_nastaliq',
        'bilingual',
        'roman_urdu'
    )),
    theme TEXT NOT NULL DEFAULT 'moment_of_calm' CHECK (theme IN (
        'resilience',
        'patience',
        'hope',
        'self_reliance',
        'overwhelmed',
        'growth',
        'understood',
        'moment_of_calm'
    )),
    secondary_content TEXT,
    reflection TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_words_of_solace_user_created ON public.words_of_solace(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_words_of_solace_theme ON public.words_of_solace(theme);

-- Enable Row Level Security (RLS)
ALTER TABLE public.words_of_solace ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'words_of_solace' AND policyname = 'Users can view own saved poems') THEN
        CREATE POLICY "Users can view own saved poems" ON public.words_of_solace FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'words_of_solace' AND policyname = 'Users can insert own saved poems') THEN
        CREATE POLICY "Users can insert own saved poems" ON public.words_of_solace FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'words_of_solace' AND policyname = 'Users can delete own saved poems') THEN
        CREATE POLICY "Users can delete own saved poems" ON public.words_of_solace FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
