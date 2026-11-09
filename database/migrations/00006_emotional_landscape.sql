-- ==============================================================================
-- Solace AI - Migration 00006: Emotional Landscape
-- Target: Supabase PostgreSQL
-- Features:
--   1. Add 'is_meaningful' bookmark column to 'public.check_ins'
--   2. Index on (user_id, is_meaningful, created_at DESC) for fast bookmark queries
--   3. Restrictive UPDATE RLS policy for public.check_ins
--   4. Database-level trigger to strictly restrict UPDATEs on check_ins to 'is_meaningful' only
--   5. Table 'public.landscape_reflections' for user-consented saved reflections
-- ==============================================================================

-- 1. Add is_meaningful column to check_ins
ALTER TABLE public.check_ins 
ADD COLUMN IF NOT EXISTS is_meaningful BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Index for bookmarked check-ins
CREATE INDEX IF NOT EXISTS idx_check_ins_meaningful 
ON public.check_ins(user_id, is_meaningful, created_at DESC);

-- 3. Row Level Security UPDATE policy for check_ins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'check_ins' AND policyname = 'Users can update own check-ins'
    ) THEN
        CREATE POLICY "Users can update own check-ins" 
        ON public.check_ins 
        FOR UPDATE 
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Database-level trigger preventing mutation of mood, intensity, note, user_id, or created_at
CREATE OR REPLACE FUNCTION public.check_ins_restrict_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id <> OLD.id 
       OR NEW.user_id <> OLD.user_id 
       OR NEW.mood <> OLD.mood 
       OR NEW.intensity <> OLD.intensity 
       OR NEW.note IS DISTINCT FROM OLD.note 
       OR NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'Only is_meaningful can be modified on existing check_ins';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restrict_check_ins_update ON public.check_ins;
CREATE TRIGGER trg_restrict_check_ins_update
    BEFORE UPDATE ON public.check_ins
    FOR EACH ROW EXECUTE FUNCTION public.check_ins_restrict_update();

-- 5. User-Consented Saved Landscape Reflections Table
CREATE TABLE IF NOT EXISTS public.landscape_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timeframe TEXT NOT NULL CHECK (timeframe IN ('7d', '30d', 'all', 'moment')),
    reflection TEXT NOT NULL,
    dominant_mood TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_landscape_reflections_user_created 
ON public.landscape_reflections(user_id, created_at DESC);

ALTER TABLE public.landscape_reflections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'landscape_reflections' AND policyname = 'Users can view own landscape reflections'
    ) THEN
        CREATE POLICY "Users can view own landscape reflections" 
        ON public.landscape_reflections 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'landscape_reflections' AND policyname = 'Users can insert own landscape reflections'
    ) THEN
        CREATE POLICY "Users can insert own landscape reflections" 
        ON public.landscape_reflections 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'landscape_reflections' AND policyname = 'Users can delete own landscape reflections'
    ) THEN
        CREATE POLICY "Users can delete own landscape reflections" 
        ON public.landscape_reflections 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

