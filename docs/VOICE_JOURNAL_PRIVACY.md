# Solace AI — Voice Journal Privacy & Data Governance Specification

## 1. Privacy Philosophy & Commitment

Voice journaling involves people vocalizing intimate, unfiltered, and deeply personal thoughts. Trust is the foundational prerequisite for this experience. Solace AI enforces strict privacy boundaries designed to give users complete control over their voice data.

**Core Principles:**
1. **User Agency First**: Nothing is recorded without explicit permission, and nothing is saved without explicit user approval.
2. **Ephemeral by Default**: Audio recordings exist only for the seconds required to transcribe them into text.
3. **Domain Isolation**: Personal journal entries must never leak into conversational memory or influence AI chat behavior without consent.
4. **Honest Architectural Guarantees**: We disclose the exact technical mechanisms of storage and AI processing rather than making misleading claims about "end-to-end encryption" or "never touching the cloud."

---

## 2. Data Classification & Lifecycle

| Data Type | Persistence Location | Retention Period | Access Scope |
|:---|:---|:---|:---|
| **Raw Spoken Audio** | Mobile temp directory (`.m4a`), Backend RAM | Ephemeral (purged immediately post-transcription) | Processed only by `voiceService` and Gemini Speech-to-Text |
| **Transient Draft Transcript** | Mobile React State (`activeDraft`) | Ephemeral (discarded on cancel or navigation away) | Visible only to user on device |
| **Saved Authenticated Journal** | Supabase PostgreSQL (`public.voice_journals`) | User-controlled (retained until user deletes) | Scoped strictly to authenticated user ID via PostgreSQL RLS |
| **Saved Guest Journal** | Local device KeyStore (`ExpoSecureStoreAdapter`) | User-controlled (retained until user deletes/clears app data) | Sandboxed on user device; zero server presence |
| **AI Reflection Mirror** | Mobile React State / Database field | Ephemeral or saved alongside entry if chosen | Generated only upon explicit user tap |

---

## 3. Ephemeral Audio Pipeline

### 3.1 Mobile Audio Handling (`mobile/services/voice.ts`)
- Recording requires user permission via `Audio.requestPermissionsAsync()`.
- Audio is recorded to the application's temporary cache directory using `expo-av`.
- When the user taps stop, the audio file is converted in-memory to base64 and dispatched via HTTPS to `POST /api/v1/voice/transcribe`.
- Upon completion or cancellation:
  - The recording session is stopped and unloaded (`stopAndUnloadAsync()`).
  - Audio recording mode is deactivated on iOS and Android (`allowsRecordingIOS: false`).
  - Temporary audio files are scheduled for operating system garbage collection.
  - No background recording is ever initiated.

### 3.2 Backend Audio Handling (`backend/app/api/voice.py`)
- The FastAPI endpoint accepts base64 audio in the request payload.
- Audio is decoded in memory and passed directly to the Gemini multimodal API via client thread executor.
- In the `finally` block of the endpoint handler, `del audio_bytes` is explicitly invoked to free the buffer from Python memory.
- **Zero Raw Audio Storage**: Raw audio is **never** written to disk, Supabase storage buckets, Amazon S3, Google Cloud Storage, or persistent server filesystems.
- **Zero Audio Logging**: Loggers only record request timestamps, user IDs, and byte sizes. Audio bytes and audio payloads are strictly excluded from logging.

---

## 4. Transcript Review & Mandatory User Agency

A central risk in AI voice applications is the automatic persistence of misheard or accidental speech.

**The Solace Solution:**
- After transcription, text is loaded into an editable draft container (`VoiceJournalModal.tsx`).
- The user can:
  - Read the transcription verbatim.
  - Edit or delete typos, misheard words, or overly personal confessions.
  - Assign an optional title and mood tag.
  - Discard the draft entirely.
  - Choose whether to request an optional AI reflection.
- **Zero Auto-Save Rule**: If the user closes the modal or discards the draft without tapping "Save Journal Entry", the text is permanently dropped from state. It is never automatically committed to database or local storage.

---

## 5. Domain Isolation: Shielding Emotional Memory

Solace features an Emotional Memory system that remembers important user life context across companion conversations. However, **Voice Journals are strictly isolated from Emotional Memory**:

1. **No Automatic Extraction**: Neither `POST /api/v1/voice/transcribe` nor `POST /api/v1/journal/save` calls `memory_service.detect_potential_memory()`.
2. **No Contextual Injection**: Journal entries are never retrieved during Companion chat streaming (`memory_service.retrieve_relevant_context()`). The Companion LLM has zero knowledge of what the user wrote in their private voice journals.
3. **No Database Cross-Linking**: The `voice_journals` table has no foreign keys or relational joins to `conversations`, `conversation_messages`, or `emotional_memories`.

---

## 6. Storage Security & Honest Cryptographic Disclosures

### 6.1 Authenticated Persistence (Supabase PostgreSQL)
- **Identity Enforcement**: `user_id` is derived exclusively from the verified JWT payload (`auth.uid()`). Client-supplied user IDs are rejected.
- **Row Level Security (RLS)**: PostgreSQL enforces that `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries are permissible only when `auth.uid() = user_id`.
- **Encryption at Rest**: Supabase provides AES-256 disk encryption at rest and TLS 1.3 encryption in transit.
- **Disclosure**: This is **not** client-side end-to-end encryption (E2EE). Database administrators with superuser credentials or Supabase infrastructure operators theoretically possess cryptographic access to PostgreSQL disk tables. We do not claim E2EE.

### 6.2 Guest Persistence (Local Device Sandboxing)
- **Storage Mechanism**: Guest journals are stored locally on device using `ExpoSecureStoreAdapter`.
- **Android KeyStore Mitigation**: On Android, KeyStore SharedPreferences enforces a 2048-byte limit per key. Solace splits guest transcripts into 1,500-character keys with an index key, preventing KeyStore crash bugs while maintaining sandboxing.
- **Operating System Sandboxing**: Data is stored within the app-private sandbox directory on Android and iOS. On rooted devices or compromised operating systems, sandboxed data may be accessible to root users.
- **Guest-to-User Boundaries**: Exiting guest mode or signing in does not silently upload guest entries to cloud accounts. Any future import requires explicit user confirmation.

---

## 7. AI Reflection Model Interactions

When a user taps **"Reflect on this entry"**:
1. Only the finalized or draft transcript text is sent to `POST /api/v1/journal/reflect`. Audio is never sent.
2. The transcript is screened deterministically for acute distress or self-harm keywords before invoking external AI.
3. If no crisis is detected, the text is processed by Google Gemini using a tightly governed system prompt designed to mirror emotions without diagnosing, advising, or judging.
4. **Third-Party Processing Disclosure**: In the mobile interface, an upfront notice informs the user that audio transcription and requested reflections are processed by our configured AI provider. We do not claim AI operations occur entirely on-device.

---

## 8. Verified Crisis Screening & Non-Diagnostic Stance

- **India Helplines**: When distress is screened, Solace displays verified national resources:
  - **Tele-MANAS**: 14416 (24/7 toll-free mental health helpline).
  - **National Emergency**: 112.
- **Non-Diagnostic Policy**: Solace AI and Voice Journal reflections explicitly state that they do not provide medical diagnoses, psychiatric therapy, or clinical interventions.

