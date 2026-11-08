# Database Migrations & Supabase Configuration

This directory contains versioned SQL migrations for Solace AI targeting **Supabase PostgreSQL** with **Row Level Security (RLS)**.

---

## Migration History

### 1. `migrations/00001_initial_schema.sql`
- Creates `public.profiles` table linked to `auth.users(id) ON DELETE CASCADE`.
- Enables Row Level Security (RLS).
- Defines security policies:
  - `"Users can view own profile"`: `auth.uid() = id`
  - `"Users can update own profile"`: `auth.uid() = id`
- Sets up `handle_new_user()` trigger to automatically create a profile entry upon Supabase registration.
- Sets up `set_updated_at()` trigger for automated timestamp updates.

### 2. `migrations/00002_user_profiles_and_onboarding.sql`
- Adds `preferred_name` (TEXT) for warm, personalized greetings.
- Adds `onboarding_completed` (BOOLEAN, default `false`) for first-time user routing.
- Adds `wellness_goals` (JSONB, default `'[]'::jsonb`).
- Adds `interaction_style` (TEXT) for companion tone preferences (`gentle`, `grounded`, `practical`).
- Creates performance indexes on `id` and `onboarding_completed`.
- Upgrades `handle_new_user()` trigger to populate both `display_name` and `preferred_name` from signup metadata.

### 3. `migrations/00003_phase3_emotional_intelligence.sql`
- Creates `public.check_ins`: Daily mood check-ins (`mood`, `intensity` 1-5, `note`, `created_at`).
  - Supports controlled moods: `peaceful`, `grateful`, `reflective`, `anxious`, `heavy`, `hopeful`.
  - RLS policies for strict user isolation (SELECT, INSERT, DELETE).
- Creates `public.conversation_sessions`: Chat session threads with `user_id`, `title`, `created_at`, `updated_at`, `archived_at`.
  - RLS policies for strict session privacy per user.
- Creates `public.conversation_messages`: Chronological messages persisted individually with `session_id`, `role` (`user`, `assistant`), `content`, `metadata` JSONB.
  - Multi-column indexes on `(session_id, created_at)` for high-performance message retrieval.
- Creates `public.user_memories`: Consent-based emotional memories (`memory_text`, `category`, `source`, `consent_status`, `is_active`).
  - Strict RLS user isolation.
  - Granular categories: `preferences`, `goals`, `ongoing_challenges`, `relationships`, `coping_strategies`, `important_context`.
- Sets up automated triggers to touch `conversation_sessions.updated_at` when messages are persisted.

---

## How to Apply Migrations to Your Supabase Project

> [!IMPORTANT]
> Because Supabase credentials are configured via environment variables, these migrations must be executed against your live Supabase database instance.

### Option A: Supabase Dashboard (Recommended)
1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project and select the **SQL Editor** from the left navigation.
3. Paste and run `00001_initial_schema.sql`.
4. Paste and run `00002_user_profiles_and_onboarding.sql`.

### Option B: Supabase CLI
```bash
supabase login
supabase link --project-ref <your-project-id>
supabase db push
```
