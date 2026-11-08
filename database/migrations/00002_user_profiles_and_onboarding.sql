-- ==============================================================================
-- Solace AI - Migration 00002: User Profiles & Onboarding Schema
-- Target: Supabase PostgreSQL
-- Features: Extends profiles table with onboarding flags, preferred name,
--           wellness goals, interaction style, and optimized indexes.
-- ==============================================================================

-- 1. Ensure required profile columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferred_name') THEN
        ALTER TABLE public.profiles ADD COLUMN preferred_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wellness_goals') THEN
        ALTER TABLE public.profiles ADD COLUMN wellness_goals JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'interaction_style') THEN
        ALTER TABLE public.profiles ADD COLUMN interaction_style TEXT;
    END IF;
END $$;

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed);

-- 3. Update the handle_new_user trigger to populate preferred_name and initialize onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_name TEXT;
BEGIN
    raw_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        preferred_name,
        onboarding_completed,
        preferences,
        wellness_goals,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        raw_name,
        raw_name,
        false,
        '{}'::jsonb,
        '[]'::jsonb,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to ensure latest function version is invoked
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify RLS policies are active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

