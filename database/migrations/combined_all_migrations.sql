-- ==============================================================================
-- SOLACE AI — COMPLETE UNIFIED DATABASE MIGRATION (00001 + 00002 + 00003)
-- Target: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Profiles Table & Triggers (00001 & 00002)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    preferred_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false NOT NULL,
    wellness_goals JSONB DEFAULT '[]'::jsonb,
    interaction_style TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed);

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to handle profile creation on user sign-up in auth.users
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 2. Mood Check-ins Table & RLS (00003)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mood TEXT NOT NULL CHECK (mood IN ('peaceful', 'grateful', 'reflective', 'anxious', 'heavy', 'hopeful')),
    intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 5),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_created ON public.check_ins(user_id, created_at DESC);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'check_ins' AND policyname = 'Users can view own check-ins') THEN
        CREATE POLICY "Users can view own check-ins" ON public.check_ins FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'check_ins' AND policyname = 'Users can insert own check-ins') THEN
        CREATE POLICY "Users can insert own check-ins" ON public.check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'check_ins' AND policyname = 'Users can delete own check-ins') THEN
        CREATE POLICY "Users can delete own check-ins" ON public.check_ins FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ==============================================================================
-- 3. Conversation Sessions Table & RLS (00003)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON public.conversation_sessions(user_id, updated_at DESC);

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_sessions' AND policyname = 'Users can view own sessions') THEN
        CREATE POLICY "Users can view own sessions" ON public.conversation_sessions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_sessions' AND policyname = 'Users can insert own sessions') THEN
        CREATE POLICY "Users can insert own sessions" ON public.conversation_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_sessions' AND policyname = 'Users can update own sessions') THEN
        CREATE POLICY "Users can update own sessions" ON public.conversation_sessions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_sessions' AND policyname = 'Users can delete own sessions') THEN
        CREATE POLICY "Users can delete own sessions" ON public.conversation_sessions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ==============================================================================
-- 4. Conversation Messages Table & RLS (00003)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.conversation_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON public.conversation_messages(user_id, created_at DESC);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_messages' AND policyname = 'Users can view own messages') THEN
        CREATE POLICY "Users can view own messages" ON public.conversation_messages FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_messages' AND policyname = 'Users can insert own messages') THEN
        CREATE POLICY "Users can insert own messages" ON public.conversation_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_messages' AND policyname = 'Users can delete own messages') THEN
        CREATE POLICY "Users can delete own messages" ON public.conversation_messages FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ==============================================================================
-- 5. User-Controlled Emotional Memories Table & RLS (00003)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'preferences',
        'goals',
        'ongoing_challenges',
        'relationships',
        'coping_strategies',
        'important_context'
    )),
    source TEXT NOT NULL CHECK (source IN ('conversation', 'check_in', 'user_created')),
    consent_status TEXT NOT NULL CHECK (consent_status IN ('approved', 'pending', 'declined')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_user_active ON public.user_memories(user_id, is_active, created_at DESC);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memories' AND policyname = 'Users can view own memories') THEN
        CREATE POLICY "Users can view own memories" ON public.user_memories FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memories' AND policyname = 'Users can insert own memories') THEN
        CREATE POLICY "Users can insert own memories" ON public.user_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memories' AND policyname = 'Users can update own memories') THEN
        CREATE POLICY "Users can update own memories" ON public.user_memories FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memories' AND policyname = 'Users can delete own memories') THEN
        CREATE POLICY "Users can delete own memories" ON public.user_memories FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

