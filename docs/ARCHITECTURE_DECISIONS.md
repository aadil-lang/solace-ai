# Solace AI — Architecture Decision Records (ADRs)

## Status Legend
- **ACCEPTED**: Approved and authoritative for implementation.
- **PROPOSED**: Under review.
- **REJECTED**: Evaluated and discarded.

---

## ADR-001: LangGraph Workflow Orchestration with Native Fallback
- **Status**: ACCEPTED
- **Context**: Solace requires modular, extensible workflow routing across multiple wellness capabilities (Companion, Poetry, Journals, Wellbeing) without destabilizing the audited 4.97/5.00 baseline or introducing streaming latency degradation.
- **Decision**: 
  1. Implement LangGraph via a unified `OrchestratorGraph` wrapped in a feature flag (`ENABLE_LANGGRAPH_ROUTING`, default: `false`).
  2. Implement graph nodes using typed Pydantic contracts and async state transformations.
  3. Stream tokens directly from Gemini model nodes using `astream_events` to preserve Server-Sent Events (SSE) behavior without full-response buffering.
  4. Retain the existing native monolithic pipeline as an automated fallback if graph compilation or execution encounters an unhandled exception.
- **Consequences**:
  - *Positive*: Modular, testable node boundaries; clean multi-turn routing; safe feature flagging.
  - *Negative*: Introduces LangGraph and LangChain-core dependencies; requires careful exception handling on client socket disconnects.

---

## ADR-002: Authoritative Deterministic Safety Screening Prior to Model Routing
- **Status**: ACCEPTED
- **Context**: Mental health safety requires zero latency and zero tolerance for model hallucination, soft refusals, or delayed interception when self-harm or suicidal intent is expressed.
- **Decision**:
  1. Deterministic regex and keyword pattern matching (`HIGH_RISK_PATTERNS` / `FALSE_POSITIVE_PATTERNS`) remains the primary, authoritative gatekeeper.
  2. Crisis screening executes synchronously in the FastAPI route and at the entry node of any LangGraph workflow prior to LLM invocation.
  3. When triggered, immediate localized help resources (India Tele-MANAS `14416`, Emergency `112`, and `findahelpline.com`) are returned, terminating the generation pipeline immediately.
  4. Never delegate crisis detection solely to an LLM or graph classifier.
- **Consequences**:
  - *Positive*: Sub-millisecond response time; 100% deterministic safety guarantee; compliance with Indian clinical and legal guidelines.
  - *Negative*: Regular expressions require continuous maintenance for emerging idiomatic expressions.

---

## ADR-003: Ephemeral Audio Lifecycle & Zero-Retention Storage Policy
- **Status**: ACCEPTED
- **Context**: Voice Journal and Push-to-Talk audio contain intimate user confessions. Storing raw audio files indefinitely in cloud storage poses severe privacy risks and regulatory liability.
- **Decision**:
  1. Raw audio captured via `expo-av` on the mobile device is transmitted as an ephemeral base64 payload over HTTPS.
  2. The backend transcribes audio directly via Gemini's multimodal speech-to-text API.
  3. Raw audio buffers are deleted immediately from Python memory (`del audio_bytes`) in a `finally:` block without writing to backend disk or object storage.
  4. Mobile temporary audio files are purged from device cache immediately upon successful transcription or cancellation.
  5. Only user-reviewed text transcripts are persisted upon explicit user tap of "Save Journal".
- **Consequences**:
  - *Positive*: Absolute privacy guarantee; zero cloud storage costs for raw audio; minimal data breach surface.
  - *Negative*: Audio replay is only available locally on the device prior to saving; cannot offer server-side audio playback across devices.

---

## ADR-004: Strict Isolation Between Domain Data and Emotional Memory Ingestion
- **Status**: ACCEPTED
- **Context**: Solace features consent-based emotional memory. If user journals, creative poems, or wellbeing suggestions silently become conversational memories, user trust is violated.
- **Decision**:
  1. User journals (`public.voice_journals`), saved poems (`public.words_of_solace`), and wellbeing interactions (`public.holistic_suggestions`) are stored in distinct database tables.
  2. The Companion context assembler (`memory_service.py`) is strictly prohibited from querying journal entries, poems, or suggestions unless explicit, affirmative per-item user consent is granted.
  3. Memory extraction (`detect_potential_memory`) operates solely on direct Companion chat conversations.
- **Consequences**:
  - *Positive*: Clean privacy compartmentalization; users can write uninhibited journals knowing they will not be brought up unexpectedly in casual conversation.
  - *Negative*: Solace cannot automatically synthesize insights across journals and conversations without an explicit user-initiated bridging action.

---

## ADR-005: Procedural Reanimated Architecture for Emotional Landscape
- **Status**: ACCEPTED
- **Context**: The Emotional Landscape requires an ambient, fluid visual sanctuary responsive to user moods. Full 3D game engines (Expo GL, Three.js) introduce heavy APK bundle sizes (15–30 MB), high battery drain, and frequent OpenGL crashes on low-end Android devices.
- **Decision**:
  1. Build the Emotional Landscape using declarative React Native Reanimated (version 3.16+) and SVG procedural gradients.
  2. Implement an organic pulsing sanctuary with gentle floating particles, ambient radial gradients, and smooth color transitions driven by UI-thread worklets.
  3. Provide an explicit Reduced-Motion toggle that instantly replaces animations with tranquil, static ambient gradient compositions.
  4. Enforce strict cleanup of animation worklets when the user navigates away or unmounts the screen.
- **Consequences**:
  - *Positive*: Lightweight (<150 KB added to APK); 60fps native performance; zero GPU crash risks on budget Android hardware; battery conscious.
  - *Negative*: Limited to 2D ambient and procedural geometric particle effects rather than full 3D interactive mesh worlds.

---

## ADR-006: Non-Prescriptive Deterministic Guardrails for Holistic Wellbeing
- **Status**: ACCEPTED
- **Context**: Providing lifestyle or wellbeing suggestions risks drifting into unauthorized medical, dietary, or psychiatric advice.
- **Decision**:
  1. Holistic suggestions are categorized strictly into: Gentle Movement, Hydration, Breathwork, Mindful Rest, Screen Breaks, and Everyday Balanced Nourishment.
  2. Hard negative constraints: Prompts and deterministic filters must explicitly reject prescriptions, diagnosis, supplement regimens, extreme fasting, and claims of "curing anxiety" or "resetting the nervous system."
  3. All suggestions must include an explicit "Dismiss" button and a disclaimer that Solace provides everyday wellness practices, not medical care.
  4. Dismissed suggestion categories are recorded to prevent repetitive nudges.
- **Consequences**:
  - *Positive*: Clinically responsible, safe wellness recommendations; avoids user guilt or nagging.
  - *Negative*: Suggestions remain humble and everyday in scope, rather than hyper-personalized health plans.

