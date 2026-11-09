# Solace AI — Official Hackathon Demo Video Script & Production Kit

**Status**: Code Frozen (`bdf3493`)  
**Target Duration**: 3 minutes 15 seconds (195 seconds)  
**Resolution**: 1080p (1080 × 2400 on Pixel 7 or 1080 × 1920 cropped)  
**Tone**: Warm, grounded, articulate, confident, and deeply human  

---

## 1. Executive Summary & Judging Alignment

Hackathon judges look for four distinct pillars:
1. **The Human Problem & Empathy**: Does this solve a real, pervasive human struggle?
2. **Technological Depth & Innovation**: Is this an API wrapper or a sophisticated multi-layered architecture?
3. **Product Design & User Experience**: Does the app feel cohesive, polished, calm, and production-ready?
4. **Safety, Privacy & Ethics**: Is sensitive emotional data handled with uncompromising integrity?

This script is structured to score maximum points across all four pillars within 3 minutes.

---

## 2. Pre-Flight Preparation Checklist

Before hitting record:
- [ ] **Warm Backend**: Execute `curl https://solace-ai-p2ft.onrender.com/health` to ensure the Render free-tier instance is warm (~700ms response).
- [ ] **Active Account**: Verify `test_rls_landscape_a@solace.internal` / `SolaceTest123!` is logged in on `emulator-5554` (Pixel 7).
- [ ] **Clean Emulator State**: Close any open keyboards or diagnostic modals. Start on the **Home Tab**.
- [ ] **Audio Setup**: Test your microphone. Speak calmly and slightly slower than conversational speed—Solace is a wellness sanctuary, and the voiceover should reflect that peace.

---

## 3. Second-by-Second Storyboard & Narration Script

```
================================================================================
ACT 1: THE HOOK & THE CRISIS OF OVERWHELM (0:00 – 0:35)
Goal: Establish the emotional stakes and introduce Solace as a calm sanctuary.
================================================================================
```

| Time | On-Screen Action | Spoken Narration (Word-for-Word) | Visual / Focus Notes |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:12** | App opens smoothly on the **Welcome Screen** showing the Solace logo, gentle palette, and tagline: *"A little space to feel understood."* | *"We live in the most hyper-connected era in human history—yet millions of people go through their days carrying heavy, untangled thoughts with nowhere safe to put them."* | Emphasize the warm aesthetic. Solace does not feel like an aggressive productivity tool. |
| **0:12 - 0:24** | Tap **"Explore as Guest"**. The app immediately transitions to the Home Tab with the banner explaining emotional data stays local. | *"Most mental health tools feel either coldly clinical, or they demand your personal data before offering help. Meet Solace—an AI emotional wellness sanctuary designed with radical privacy and gentle empathy from day one."* | Highlight the instant guest access without forced onboarding walls. |
| **0:24 - 0:35** | Show the **Sign In** screen and log into the authenticated account (`test_rls_landscape_a@solace.internal`). The Home tab loads with: *"Good evening, Friend. Whatever today feels like, there's room for it here."* | *"For users who want continuous care across devices, Solace integrates end-to-end encrypted Supabase authentication with strict Row Level Security."* | Smooth transition to the personalized authenticated view. |

```
================================================================================
ACT 2: DAILY MINDFUL RITUAL & LOCAL-FIRST RESILIENCE (0:35 – 1:10)
Goal: Showcase low-friction mood tracking and robust offline-first architecture.
================================================================================
```

| Time | On-Screen Action | Spoken Narration (Word-for-Word) | Visual / Focus Notes |
| :--- | :--- | :--- | :--- |
| **0:35 - 0:50** | On the Home tab, tap mood chip **"Peaceful"**, select Intensity **4 ("Noticeable")**, and tap **"Saved for Today • Tap to update"**. The check-in saves instantly. | *"Every mindful journey begins with noticing. Solace makes emotional check-ins effortless and non-judgmental. You can register your core state in seconds, add reflection notes, and update your feelings as your day shifts."* | Showcase the unified, single-button save/update interaction designed in Step 4. |
| **0:50 - 1:10** | Briefly swipe down system settings to toggle Airplane mode on, change the mood to **"Reflective"**, and tap Save. The UI updates instantly to *"Logged today as reflective"*. Toggle network back on. | *"Crucially, life doesn't pause when you lose internet connection. Powered by a local SQLite engine, Solace lets you log thoughts and check-ins fully offline. When you reconnect, data synchronizes quietly in the background without data duplication."* | Demonstrates offline-first architectural resilience. |

```
================================================================================
ACT 3: THE PRIVATE COMPANION & RANT MODE (1:10 – 2:05)
Goal: Demonstrate LangGraph orchestration, SSE streaming, and empathetic listening.
================================================================================
```

| Time | On-Screen Action | Spoken Narration (Word-for-Word) | Visual / Focus Notes |
| :--- | :--- | :--- | :--- |
| **1:10 - 1:25** | Tap the **Companion Tab**. The chat opens showing *"Holding space for you"*. Tap the input field and submit: *"I had a quiet evening, but my mind is still racing about tomorrow."* | *"When you need someone to talk to, the Solace Companion offers a dedicated conversational sanctuary. Built on FastAPI and LangGraph, it practices active, non-directive listening."* | Point out the calm status: *"Listening and reflecting..."* |
| **1:25 - 1:45** | The assistant response streams in token-by-token over Server-Sent Events (SSE). | *"Notice the real-time token streaming over Server-Sent Events. Solace doesn't jump to give clinical prescriptions or toxic positivity. Instead, it mirrors your feelings, validates your reality, and helps you untangle thoughts thread by thread."* | Highlight the natural, empathetic conversational tone. |
| **1:45 - 2:05** | Tap the **"Let It Out"** banner button. The header turns amber: *"Just Let It Out — Rant Mode — Free venting active. Advice is paused."* | *"And for moments when you don't want guidance, solutions, or reframing—Solace features 'Just Let It Out' Rant Mode. It pauses all advice algorithms, creating an open container where you can vent completely unconstrained."* | A standout feature that differentiates Solace from standard chatbots. |

```
================================================================================
ACT 4: BESPOKE HEALING — WORDS OF SOLACE & EMOTIONAL LANDSCAPE (2:05 – 2:50)
Goal: Showcase unique generative poetry and longitudinal atmospheric tracking.
================================================================================
```

| Time | On-Screen Action | Spoken Narration (Word-for-Word) | Visual / Focus Notes |
| :--- | :--- | :--- | :--- |
| **2:05 - 2:28** | Tap the **Discover Tab**, then tap **"Words of Solace"**. Select *"Finding Calm (Sukoon)"* and tap *"Compose Words of Solace"*. In 3 seconds, a bespoke poem (*"A Still Sanctuary"*) renders with formatted stanzas and a gentle breathing prompt. Tap **Save**. | *"Words carry healing power. In 'Words of Solace', our AI transforms your present emotional state into bespoke contemplative poetry—available in contemporary English, classic Urdu Nastaliq, and bilingual verse. It offers a meditative moment of beauty you can bookmark to your private sanctuary."* | Showcase the literary, artistic dimension of Solace. |
| **2:28 - 2:50** | Dismiss the modal via the top-right close button. Tap **"Emotional Landscape"**. Show the **Seasons** view (*"Prevailing Season: Moving through Grateful waters"*), then tap **Horizon** to show the timeline. | *"Rather than reducing human complexity to a rigid mental health score, our 'Emotional Landscape' visualizes your inner journey as longitudinal seasons—mapping where your center of gravity lies across days and weeks, with meaningful moments preserved like keepsakes."* | Highlights longitudinal emotional tracking without clinical diagnostic stigma. |

```
================================================================================
ACT 5: SAFETY, ROW LEVEL SECURITY & CLOSING (2:50 – 3:15)
Goal: Prove enterprise-grade security, ethical AI privacy, and safety protocols.
================================================================================
```

| Time | On-Screen Action | Spoken Narration (Word-for-Word) | Visual / Focus Notes |
| :--- | :--- | :--- | :--- |
| **2:50 - 3:05** | Tap the **Profile Tab**. Show the **Emotional Memory** panel (0 unconsented memories) and expand **Developer Diagnostics** showing *"Connected to Solace API"*. | *"Under the hood, Solace enforces uncompromising privacy. Audio from our Voice Journal is processed ephemerally in memory and immediately purged. Supabase Row Level Security guarantees absolute data isolation between users. And conversational memory is never stored without explicit user consent."* | Clear, indisputable technical and ethical rigor. |
| **3:05 - 3:15** | Return to the **Home Tab**. Let the camera rest on the calm sanctuary screen. | *"With automated crisis interception routing to Tele-MANAS and universal emergency helplines, Solace is safe, resilient, and deeply human. Solace AI: A little space to feel understood. Thank you."* | Confident, clean closing. |

---

## 4. One-Click Automated Demo Video Recording Script

We have prepared an automated PowerShell helper that can record the screen of `emulator-5554` directly into a high-definition MP4 file.

### How to Record:
Run the following command in PowerShell. It will record the emulator screen for exactly 195 seconds (3 min 15 sec) directly to `demo_solace_raw.mp4`:

```powershell
# Pre-warm backend
Invoke-RestMethod -Uri "https://solace-ai-p2ft.onrender.com/health" -Method Get

# Start recording emulator screen (195 seconds @ 12Mbps 1080p)
$adb = "C:\Users\HP\AppData\Local\Android\Sdk\platform-tools\adb.exe"
Write-Host "Starting video recording on emulator..." -ForegroundColor Cyan
& $adb -s emulator-5554 shell screenrecord --size 1080x2400 --bit-rate 12000000 --time-limit 195 /sdcard/demo_screen.mp4

# Pull recording to workspace
& $adb -s emulator-5554 pull /sdcard/demo_screen.mp4 demo_solace_raw.mp4
Write-Host "Demo recording pulled to demo_solace_raw.mp4!" -ForegroundColor Green
```

---

## 5. Merging Voiceover & Video with FFmpeg

Once you have recorded your voiceover audio file (e.g. `voiceover.m4a`, `voiceover.mp3`, or `voiceover.wav`), you can combine the video and audio cleanly into a production-ready MP4 using the pre-installed `ffmpeg`:

```powershell
ffmpeg -i demo_solace_raw.mp4 -i voiceover.mp3 -c:v copy -c:a aac -b:a 192k -shortest final_solace_demo.mp4
```

To crop the video to a standard 16:9 frame with aesthetic background padding or clean mobile aspect ratio:
```powershell
ffmpeg -i demo_solace_raw.mp4 -vf "pad=ih*16/9:ih:(ow-iw)/2:(oh-ih)/2:color=#0B1318" -c:a copy final_solace_demo_16x9.mp4
```

---

## 6. Hackathon Submission Pitch Checklist

When submitting the video on Devpost / submission portal, use this concise accompanying pitch summary:

- **Tagline**: Solace AI — A private, mindful emotional wellness companion with local-first resilience, empathetic active listening, and bespoke contemplative poetry.
- **Problem**: Modern digital life is overwhelmed by cognitive stress, yet existing mental wellness apps are either sterile clinical symptom-checkers or invasive tools that compromise user privacy.
- **Solution**: A calm mobile sanctuary providing active listening, free-venting Rant Mode, bilingual contemplative poetry (English & Urdu Nastaliq), and longitudinal emotional landscape tracking.
- **Tech Stack**:
  - **Frontend**: React Native, Expo 58, TypeScript, Hermes bytecode, SQLite (offline storage).
  - **Backend**: Python 3.12, FastAPI, LangGraph agentic orchestration, SSE streaming.
  - **Cloud & DB**: Supabase PostgreSQL with strict Row Level Security (RLS).
  - **Safety**: Tele-MANAS (14416), 112, and 988 emergency crisis guardrails; zero raw audio persistence.
