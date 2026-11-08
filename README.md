# Solace AI

> **"A little space to feel understood."**  
> A premium AI-powered wellness companion designed for mindful reflection, emotional grounding, and consent-based emotional memory.

---

## 1. Product Overview & Stack

Solace AI combines a serene, organic mobile user interface with a modular, highly performant Python backend.

### Mobile
- **Framework:** React Native with Expo (Managed Workflow, SDK 58)
- **Language:** TypeScript (Strict mode enabled)
- **Navigation:** Expo Router (File-based navigation with protected route guards)
- **Authentication:** Supabase Auth with Expo SecureStore session persistence
- **State Management:** Zustand (`useAuthStore`, `useAppStore`, `useCheckInStore`, `useChatStore`, `useMemoryStore`)
- **Data Synchronization:** TanStack Query (React Query v5)
- **Motion & Aesthetics:** React Native Reanimated
- **Sensory Feedback:** Expo Haptics
- **Icons:** Expo Vector Icons (Ionicons)

### Backend
- **Framework:** FastAPI (Python 3.12+)
- **Server:** Uvicorn ASGI
- **Authentication:** Supabase JWT verification dependency
- **Configuration:** Pydantic Settings v2
- **Architecture:** Modular Monolith
- **Validation:** Strict Pydantic models
- **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS)
- **AI Integration:** Google Gemini API (`google-genai` SDK v3.0.0, brokered exclusively through the backend)
- **Safety Interceptor:** Configurable regional crisis detection guard (India default: Tele-MANAS `14416` and Emergency `112`)

---

## 2. Project Structure

```
Solace AI/
├── mobile/                       # Expo React Native client
│   ├── app/                      # Expo Router navigation routes
│   │   ├── (auth)/               # Unauthenticated route group
│   │   │   ├── _layout.tsx       # Auth stack navigator
│   │   │   ├── login.tsx         # Sign in with email, validation & guest access
│   │   │   └── signup.tsx        # Registration with email/password validation
│   │   ├── (tabs)/               # Authenticated bottom tab navigation
│   │   │   ├── _layout.tsx       # Tab bar styling & Ionicons
│   │   │   ├── index.tsx         # Connected Home screen (Mood check-in, 1-5 intensity, notes, history)
│   │   │   ├── companion.tsx     # Mindful AI companion chat (SSE token streaming & memory consent banner)
│   │   │   ├── discover.tsx      # Curated wellness practices & guided modal
│   │   │   └── profile.tsx       # User profile, Emotional Memory manager & telemetry
│   │   ├── _layout.tsx           # Root navigation guard & auth state listener
│   │   ├── index.tsx             # Smart gateway router
│   │   └── onboarding.tsx        # Serene onboarding flow (Name, Goals, Tone)
│   ├── components/               # Atomic UI components (Button, Input, Card, Badge)
│   ├── constants/                # Theme tokens (colors, spacing, radii) & API config
│   ├── services/                 # Supabase client, SecureStore adapter & ApiService
│   ├── store/                    # Zustand stores (Auth, App, CheckIn, Chat, Memory)
│   ├── types/                    # Shared TypeScript interfaces
│   ├── tests/                    # Automated mobile test suite
│   │   ├── auth_and_profile.test.js
│   │   └── phase3_companion.test.js
│   ├── app.json                  # Expo config (Solace, com.solaceai.app)
│   ├── eas.json                  # EAS Build configuration for Android APK
│   ├── package.json              # Mobile package manifest
│   ├── tsconfig.json             # TypeScript configuration
│   └── .env.example              # Mobile environment template
│
├── backend/                      # Python FastAPI modular monolith
│   ├── app/
│   │   ├── api/                  # Route handlers:
│   │   │   ├── health.py         # GET /health
│   │   │   ├── profile.py        # GET/PATCH /api/v1/profile/me
│   │   │   ├── check_ins.py      # POST, GET history, DELETE /api/v1/check-ins
│   │   │   ├── conversations.py  # Session & message management
│   │   │   ├── memories.py       # User-controlled emotional memories
│   │   │   └── chat.py           # POST /api/v1/chat/stream (SSE streaming)
│   │   ├── core/                 # Config, JWT Auth dependency & Exceptions
│   │   ├── services/             # AI provider (Gemini + Mock) & Memory retrieval service
│   │   ├── schemas/              # Pydantic schemas (CheckIn, Conversation, Memory, Health)
│   │   ├── repositories/         # Repositories with in-memory fallback stores
│   │   └── main.py               # FastAPI entrypoint & CORS middleware
│   ├── tests/                    # Automated backend test suite
│   │   ├── test_health.py        # ASGI health check verification
│   │   ├── test_profile_auth.py  # JWT verification & profile CRUD verification
│   │   ├── test_phase3_emotional_intelligence.py # Check-ins, sessions, memories, SSE
│   │   ├── test_phase4_memory_lifecycle.py       # Complete 10-step memory journey
│   │   └── test_live_server.py   # Live server socket verification
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Backend environment template
│
├── database/
│   └── migrations/
│       ├── 00001_initial_schema.sql             # Profiles table, RLS policies, triggers
│       ├── 00002_user_profiles_and_onboarding.sql # Extended onboarding fields & indexes
│       └── 00003_phase3_emotional_intelligence.sql # Check-ins, sessions, messages & memories
│
├── docs/
│   ├── PROJECT_ARCHITECTURE.md   # System architecture & technology decisions
│   └── IMPLEMENTATION_PLAN.md    # Multi-phase development roadmap
│
├── .gitignore                    # Universal ignore file
└── README.md                     # Documentation & setup guide
```

---

## 3. Getting Started

### Prerequisites
- **Node.js**: v20.x or v24.x (Tested with Node.js v24.19.0, npm 12.0.2)
- **Python**: v3.12+ (Tested with Python 3.12.7)
- **Supabase Account**: (Free tier at [supabase.com](https://supabase.com))
- **Google Gemini API Key**: (Obtain from Google AI Studio)

---

### Step 1: Database Setup (Supabase)

1. Open your project on [Supabase](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Run `database/migrations/00001_initial_schema.sql`.
4. Run `database/migrations/00002_user_profiles_and_onboarding.sql`.
5. Run `database/migrations/00003_phase3_emotional_intelligence.sql`.

---

### Step 2: Backend Setup

1. **Activate virtual environment**:
   ```bash
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # macOS/Linux:
   source venv/bin/activate
   ```

2. **Configure environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Populate credentials:
   - `SUPABASE_URL`: Your Supabase Project URL (`https://<project-id>.supabase.co`)
   - `SUPABASE_KEY`: Your Supabase publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (backend only!)
   - `SUPABASE_JWT_SECRET`: Your Supabase JWT Secret (found in Project Settings > API > JWT Settings)
   - `GEMINI_API_KEY`: Your Google AI Studio API key
   - `CRISIS_REGION`: Regional emergency resources (`"IN"` for India [default], `"US"`, `"GB"`, or `"GLOBAL"`)

3. **Start the FastAPI backend**:
   ```bash
   python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
   ```
   Interactive API docs: http://localhost:8000/docs  
   Health endpoint: http://localhost:8000/health

---

### Step 3: Mobile Application Setup

1. **Navigate to the mobile directory**:
   ```bash
   cd mobile
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set:
   - `EXPO_PUBLIC_API_URL`: `http://localhost:8000` (or `http://10.0.2.2:8000` on Android emulator)
   - `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key

3. **Start the Expo development server**:
   ```bash
   npm start
   ```
   - Press **`w`** to open in web browser.
   - Press **`a`** to open on Android emulator.
   - Scan QR code with **Expo Go** on physical device.

---

## 4. Building the Android Preview APK

An `eas.json` configuration file is included in `mobile/`. To generate a standalone Android APK:

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```
2. **Log in to your Expo account**:
   ```bash
   eas login
   ```
3. **Configure project ID**:
   ```bash
   cd mobile && eas project:init
   ```
4. **Trigger Android Preview APK build**:
   ```bash
   eas build -p android --profile preview
   ```
   EAS will compile a standalone `.apk` distributable file and provide a direct download link.

---

## 5. Automated Testing & Verification

Run all test suites across the project:

### Backend Test Suites
```bash
# Verify health, JWT auth, Phase 3 intelligence, and Phase 4 memory lifecycle
.\venv\Scripts\python backend/tests/test_health.py
.\venv\Scripts\python backend/tests/test_profile_auth.py
.\venv\Scripts\python backend/tests/test_phase3_emotional_intelligence.py
.\venv\Scripts\python backend/tests/test_phase4_memory_lifecycle.py
```

### Mobile Test Suites
```bash
# Run mobile auth & session test suite
node mobile/tests/auth_and_profile.test.js

# Run Phase 3/4 companion, emotional memory & mood test suite
node mobile/tests/phase3_companion.test.js

# Verify TypeScript compilation (0 errors)
cd mobile && npx tsc --noEmit
```

---

## 6. Hackathon Live Demo Script (2–3 Minutes)

This demo presents Solace AI's core capabilities using **real application logic** without fabricated data.

### Step 1: Serene Home & Time-of-Day Grounding (0:00 - 0:30)
1. Launch Solace. Show the calm Warm Ivory & Sage interface.
2. Point out the dynamic greeting reflecting the user's preferred name (*"Good afternoon, Aanya"*).
3. Tap a mood chip (e.g., **"Anxious"**).
4. Demonstrate the **Intensity Selector** (1–5 scale with descriptive labels) and enter a personal note: *"Overwhelmed by project deadline"*.
5. Tap **"Save Check-in"**. Point out the immediate update in **"Your Reflection History"** showing real entries without mock filler.

### Step 2: Mindful AI Companion & Real Streaming (0:30 - 1:15)
1. Navigate to the **Companion** tab.
2. Select a thoughtful conversation starter or type:  
   *"I've been feeling tight in my chest and struggling to focus on work today."*
3. Watch the assistant response stream in smoothly token-by-token with unhurried, empathetic pacing.
4. Point out the mindful tone: Solace validates the user's emotion before offering a gentle, grounded reflection.

### Step 3: Signature Feature — Consent-Based Emotional Memory (1:15 - 2:00)
1. Notice the **Memory Consent Banner** that appears above the chat composer:  
   *"Emotional Memory Notice: Solace noticed: 'Struggling with focus and chest tightness during work stress'. Would you like Solace to remember this?"*
2. Emphasize Solace's core differentiator: **No secret recording. The user holds 100% consent.**
3. Tap **"Remember this"** (Approve). Solace securely saves the insight under the `ongoing_challenges` category.

### Step 4: Context Continuity in a New Conversation (2:00 - 2:30)
1. Tap the **New Conversation** icon (`+`) in the header.
2. Send a new message:  
   *"It's afternoon now and that familiar work pressure is creeping back."*
3. Show the header subtitle indicator: *"Referenced 1 personal reflection"*.
4. Solace weaves the consented context naturally into its response, demonstrating genuine continuity.

### Step 5: Full User Control in Sanctuary / Profile (2:30 - 2:50)
1. Switch to the **Profile** tab.
2. Scroll to the **"Emotional Memory"** management center.
3. Show the saved memory tagged with its category.
4. Demonstrate the **Active Switch** (temporarily disabling memory recall).
5. Demonstrate the **Delete / Forget Button** (permanently purging the memory from the database).

### Step 6: Crisis Safety Guard (2:50 - 3:00)
1. Mention the safety architecture: If acute crisis or self-harm keywords are detected, Solace immediately provides localized, human support resources (India's **Tele-MANAS 14416** and Emergency **112**) with zero delay, ensuring user safety is always paramount.
