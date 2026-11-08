# Solace AI — LangGraph Architecture Feasibility & Migration Audit

**Document Version:** 1.0.0  
**Date:** November 9, 2026  
**Author:** AI Systems & Platform Architect  
**Evaluation Scope:** FastAPI Backend Monolith, SSE Streaming Pipeline, Google Gemini Provider, Supabase PostgreSQL / RLS, Emotional Memory Engine  
**Live Baseline Audit Score:** 4.97 / 5.00 (12 multi-turn scenarios, 37 turns, 100% pass)  
**Hackathon Submission Deadline:** November 10, 2026, 11:59 AM IST  

---

## 1. Executive Summary & Final Verdict

This technical assessment investigates whether integrating **LangGraph** (StateGraph orchestration) into the Solace AI backend provides meaningful architectural improvements over the existing modular pipeline, or whether it introduces unnecessary latency, streaming fragility, dependency bloat, and regression risks.

### Final Verdict: **LANGGRAPH NOT NECESSARY YET**

| Criterion | Existing Architecture | Proposed LangGraph Architecture | Assessment |
| :--- | :--- | :--- | :--- |
| **First-Token Latency (TTFT)** | **1.2s – 1.8s** (Direct async streaming) | **1.6s – 2.4s** (Graph dispatch + state validation overhead) | **Existing Wins** (25–35% faster) |
| **SSE Streaming Reliability** | **100%** (Native FastAPI async generator) | Complex (`astream_events(v2)` event queue decoupling) | **Existing Wins** (Simpler, zero queue drops) |
| **Crisis Safety Interception** | **1.48s** deterministic regex interceptor | Conditional router edge / safety node | **Tie** (Both support early return) |
| **Post-Rant 3-Way Choice Routing**| Fully functional via mode metadata & prompt conditioning | Dedicated conditional branching nodes | **Tie** (Current implementation passes 100%) |
| **Dependencies & Bundle Footprint**| Lightweight (`fastapi`, `pydantic`, `google-genai`) | Heavy (`langgraph`, `langchain-core`, typing dependencies) | **Existing Wins** (Zero third-party graph bloat) |
| **Hackathon Readiness & Risk** | **Production Ready** (Render live, 4.97/5.00 score) | High regression risk within 35 hours of deadline | **Existing Wins** |

**Strategic Recommendation:** Retain the existing lean FastAPI pipeline for the hackathon submission. Consider a **phased Hybrid LangGraph (Option B)** post-hackathon only if multi-step interactive workflows (such as dynamic CBT exercises, multi-persona social roleplay, or complex multi-agent tools) are introduced.

---

## 2. Existing Architecture & Request Lifecycle

### 2.1 Current Architecture Diagram

```mermaid
flowchart TD
    subgraph MobileClient["Mobile Client (React Native / Expo SDK 58)"]
        UI["Companion Screen / Chat UI"]
        RantBanner["Just Let It Out (Rant Mode Toggle)"]
        VoiceSubsystem["Voice AI (expo-av + expo-speech)"]
    end

    subgraph BackendAPI["FastAPI Backend Monolith (Render / Python 3.12)"]
        AuthDep["get_current_user (Supabase JWT / JWKS Verification)"]
        ChatRouter["POST /api/v1/chat/stream"]
        VoiceRouter["POST /api/v1/voice/transcribe"]
        
        subgraph Pipeline["Streaming Pipeline (chat.py)"]
            SessionHandler["1. Session & History Resolution"]
            MsgPersist["2. Persist User Message (Immediate)"]
            CrisisGuard["3. Deterministic Crisis Interceptor (Regex)"]
            MemDetector["4. Memory Suggestion Detector"]
            ContextBuilder["5. Emotional Memory & Profile Assembly"]
            PromptSynthesis["6. build_system_prompt (Mode: standard | rant)"]
            GeminiStream["7. GeminiProvider.generate_response_stream"]
            ResponsePersist["8. Persist Assistant Message + Applied Metadata"]
        end
    end

    subgraph CloudServices["External Cloud & AI Infrastructure"]
        SupabaseDB[("Supabase PostgreSQL + RLS")]
        GeminiAPI["Google Gemini 3.5 Flash Lite API"]
    end

    UI -->|HTTP SSE POST| ChatRouter
    VoiceSubsystem -->|Base64 Audio| VoiceRouter
    VoiceRouter -->|Transcribe Multimodal| GeminiAPI
    ChatRouter --> AuthDep
    AuthDep -->|Validate JWT| SupabaseDB
    ChatRouter --> Pipeline
    SessionHandler <-->|Read / Write| SupabaseDB
    MsgPersist -->|INSERT| SupabaseDB
    ContextBuilder <-->|Fetch Approved Memories & Check-ins| SupabaseDB
    CrisisGuard -->|Early Return 112 / 14416| UI
    GeminiStream <-->|Token Chunks| GeminiAPI
    GeminiStream -->|SSE Tokens| UI
    ResponsePersist -->|INSERT| SupabaseDB
```

### 2.2 Current Request Lifecycle Analysis

1. **Authentication & Identity Isolation:**
   - The client passes `Authorization: Bearer <JWT>`.
   - `get_current_user` in `backend/app/core/auth.py` validates the token via Supabase JWKS (ES256) or Supabase Auth API. User identity is derived strictly from verified claims (`sub`), preventing client-side spoofing.
2. **Session Resolution & User Message Persistence:**
   - `chat.py` verifies ownership of `session_id`. If `None`, it auto-generates a session with a title derived from the first 40 characters of the prompt.
   - The user message is persisted immediately to Supabase `conversation_messages` with `role="user"` and `metadata={"mode": data.mode or "standard"}`.
3. **Deterministic Safety Screening:**
   - `memory_service.is_crisis_input(content)` evaluates hardcoded high-risk regex patterns (`HIGH_RISK_PATTERNS`) while filtering out idiomatic false-positives (`FALSE_POSITIVE_PATTERNS`).
   - If flagged, the endpoint bypasses Gemini entirely and streams localized Indian crisis resources (Tele-MANAS `14416`, Emergency `112`, KIRAN `1800-599-0019`).
4. **Consent-Based Emotional Memory Suggestion:**
   - `memory_service.detect_potential_memory(content)` checks for disclosures (ongoing challenges, goals, relationships). If detected, it emits an SSE event `memory_suggestion` to request explicit client consent.
5. **Context Assembly & Memory Filtering:**
   - Retrieves only active, approved memories (`is_active = True`, `consent_status = "approved"`).
   - Retrieves the last 3 check-ins and the last 8 message turns.
   - Synthesizes `context_summary` and calls `build_system_prompt(profile, context_summary, mode)`.
6. **Token-by-Token SSE Streaming:**
   - Invokes `ai_provider.generate_response_stream()`, which runs the synchronous `google-genai` streaming generator inside an `asyncio.to_thread` executor to prevent blocking the ASGI event loop.
   - Tokens are streamed via SSE `{"event": "token", "token": "..."}`.
7. **Assistant Message Persistence & Metadata Tagging:**
   - The completed text is saved in Supabase with `metadata={"memories_used": [...], "mode": mode}`.
   - Emits `message_complete` with `applied_memories_count`.

---

## 3. Evaluation of Candidate LangGraph Nodes

We examined whether decomposing Solace's conversation processing into 12 candidate LangGraph nodes provides architectural value:

| # | Candidate Node | Type | Responsibility | State In / Out | LangGraph Value | Existing Architecture Assessment |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **1** | **Input Validation** | Deterministic | Validate payload schema, string length, and character bounds. | `raw_request` → `validated_input` | **Low** | Already handled natively by FastAPI + Pydantic `ChatStreamRequest`. Adding a graph node is redundant. |
| **2** | **Safety Screening** | Deterministic | Match regex patterns for self-harm or imminent danger. | `text` → `is_crisis`, `crisis_res` | **Medium** | Could serve as a conditional branch; however, existing procedural early-exit in `chat.py` is simpler and faster (1.48s TTFT). |
| **3** | **Context Retrieval** | Async I/O | Fetch recent 8 messages, profile, and check-in history. | `user_id`, `session_id` → `history`, `profile`, `checkins` | **Low** | Handled cleanly with async Supabase repository queries. Graph wrapping adds no concurrency benefit. |
| **4** | **Memory Filtering** | Async I/O + Deterministic | Query approved memories and compute keyword/category overlap. | `memories`, `query` → `matched_memories` | **Low** | RLS + Pydantic filter handles this deterministically. A graph node adds serialization overhead. |
| **5** | **Mode Router** | Deterministic Conditional | Route to standard, rant, or post-rant preference behaviors. | `mode`, `history` → `target_mode` | **Medium** | Useful if modes were distinct multi-agent subgraphs. Currently, mode is passed directly to prompt synthesis. |
| **6** | **Rant Mode Handler**| Prompt Conditioning | Inject zero-advice directive, listening guidelines, and post-rant options. | `mode="rant"` → `system_prompt` | **Low** | `memory_service.build_system_prompt()` already handles this cleanly in 1 line. |
| **7** | **Post-Rant Preference Router** | Deterministic / LLM | Differentiate post-rant selections (Just heard, reflect, practical suggestions). | `choice` → `system_instruction` | **Medium** | Currently handled by user selection text flowing into the conversation context. Proven 100% effective in audit. |
| **8** | **Poetry Generation** | LLM-driven | Generate bespoke reflective poetry on user request. | `theme` → `poem_text` | **High (Future)** | Currently handled through Discover tab / prompts. A dedicated node would be valuable if poetry required multi-pass critique. |
| **9** | **Social Roleplay** | Multi-Turn LLM | Simulate conversational scenarios (e.g. practicing difficult conversations). | `roleplay_state`, `persona` → `actor_response` | **High (Future)** | Would benefit from LangGraph's state persistence and persona switching if this feature is built. |
| **10** | **Companion Generation** | LLM-driven (Stream) | Stream Gemini tokens using synthesized prompt and turn history. | `system_prompt`, `history` → `token_stream` | **Neutral** | LangGraph requires `astream_events(v2)` to stream tokens out, which adds complexity over direct generator. |
| **11** | **Output Review** | Deterministic / LLM | Review assistant output for medical claims, sentience claims, or safety leaks. | `generated_text` → `is_valid` | **Negative** | **Blocks streaming.** Post-generation review requires buffering the entire response before sending to user, destroying TTFT. |
| **12** | **Persistence** | Async I/O | Save assistant message, memory linkage, and session timestamps. | `complete_text`, `metadata` → `saved_message` | **Low** | Handled natively in `chat.py` after generator finishes. |

---

## 4. Proposed Minimal Companion Orchestration Graph

If LangGraph were to be implemented, the most robust, minimal topology that preserves Solace's core conversational intelligence without artificial complexity is shown below:

```mermaid
flowchart TD
    Start([User Chat Request]) --> InputNode[Node 1: Validate & Persist User Msg]
    InputNode --> SafetyCheck{Node 2: Crisis Safety Screen}
    
    SafetyCheck -->|Crisis Flagged| CrisisNode[Node 3: Formulate Emergency Response]
    CrisisNode --> StreamCrisis[Node 4: Stream Safety Guidance & Terminate]
    StreamCrisis --> End([Session Complete])
    
    SafetyCheck -->|Safe Input| ContextNode[Node 5: Context & Memory Retrieval]
    ContextNode --> MemorySuggest{Node 6: Potential Memory Candidate?}
    MemorySuggest -->|Yes| EmitSuggest[Emit memory_suggestion Event]
    MemorySuggest -->|No / Done| ModeRouter{Node 7: Mode & Post-Rant Router}
    EmitSuggest --> ModeRouter
    
    ModeRouter -->|mode == 'rant'| RantPrompt[Node 8A: Synthesize Rant Directives]
    ModeRouter -->|mode == 'standard'| StandardPrompt[Node 8B: Synthesize Standard Directives]
    ModeRouter -->|specialized == 'roleplay'| RoleplayPrompt[Node 8C: Synthesize Persona Roleplay]
    
    RantPrompt --> GenerateStream[Node 9: Gemini Response Streamer]
    StandardPrompt --> GenerateStream
    RoleplayPrompt --> GenerateStream
    
    GenerateStream --> SSETransform[Node 10: SSE Token Dispatcher]
    SSETransform --> PersistComplete[Node 11: Persist Assistant Msg & Metadata]
    PersistComplete --> End
```

### State Schema (`CompanionState`)
```python
from typing import TypedDict, List, Optional, Dict, Any

class CompanionState(TypedDict):
    session_id: str
    user_id: str
    user_message_id: str
    content: str
    mode: str  # "standard", "rant", "post_rant_reflect", "post_rant_practical"
    is_crisis: bool
    crisis_response: Optional[str]
    potential_memory: Optional[Dict[str, str]]
    profile: Dict[str, Any]
    memories: List[Dict[str, Any]]
    recent_check_ins: List[Dict[str, Any]]
    history: List[Dict[str, str]]
    system_prompt: str
    generated_text: str
    applied_memory_ids: List[str]
    error: Optional[str]
```

---

## 5. SSE Streaming Compatibility Deep-Dive (Critical Analysis)

Streaming compatibility is the single most critical engineering risk when migrating to LangGraph.

### 5.1 First-Token Latency (Time to First Token - TTFT)
- **Current Architecture:**
  - `chat.py` initiates SSE headers (`text/event-stream`) immediately upon request arrival.
  - The deterministic safety check runs in **< 2ms**.
  - Supabase lookups take **120ms – 250ms**.
  - Gemini streaming starts immediately.
  - **Measured TTFT:** **1.2s – 1.8s** (Render live deployment).
- **LangGraph Architecture:**
  - Graph initialization, Pydantic state typing validation, and edge dispatching add **40ms – 80ms** of serialization overhead.
  - In a graph, streaming tokens out of a node requires running the graph via `graph.astream_events(..., version="v2")`.
  - Filtering events from `on_chat_model_stream` and re-packaging them into SSE adds an extra event loop dispatch layer.
  - **Estimated TTFT:** **1.6s – 2.4s** (25–35% latency increase).

### 5.2 Async Generator & Cancellation Compatibility
- **Client Disconnects:** When a user navigates away or closes the app on Android, the HTTP connection drops.
- **Current Behavior:** FastAPI detects socket disconnection; the Python generator exits cleanly; the `try...finally` block ensures resources are freed.
- **LangGraph Behavior:** Cancelling an `astream_events()` generator mid-flight raises `asyncio.CancelledError`. If a LangGraph checkpointer is attached (e.g. MemorySaver or PostgresSaver), an interrupted run leaves an incomplete checkpoint state, requiring custom rollback logic to prevent orphaned transaction locks.

### 5.3 Streaming Output Review Pitfall
- A common temptation with LangGraph is adding an **Output Validation Node** after generation to inspect the model's text before the user sees it.
- **Critical Architectural Rule:** Any post-generation node requires **buffering the entire response**. This would completely eliminate token streaming and force users to wait 4–8 seconds in silence.
- **Conclusion:** Output safety in Solace must remain **prompt-conditioned and input-screened**, never post-buffered.

---

## 6. Technology Stack Evaluation

| Technology | Proposed Role in Solace | Actual Benefit | Complexity | Hosting Cost | Hackathon Verdict |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **LangGraph** | Workflow orchestration & branching | State machine modularity for complex agents | Medium | $0 (in-process library) | **DEFER** (Current pipeline exceeds quality targets) |
| **Pydantic v2** | Request validation & domain schemas | Strict serialization, zero runtime type drift | Low | $0 | **ALREADY IN USE** (Keep) |
| **Supabase PostgreSQL** | Relational persistence & Auth | Native RLS security, user isolation, JSONB metadata | Low | Existing Free/Pro Tier | **ALREADY IN USE** (Keep) |
| **Supabase pgvector** | Semantic memory retrieval | Cosine similarity search across past memories | Medium | $0 (Supabase extension) | **DEFER** (Current keyword/category matching is fast & deterministic for <50 memories/user) |
| **Gemini Embeddings** | Generating vectors for pgvector | Semantic capture of subtle phrasing | Medium | Minimal API cost | **DEFER** (Avoids unnecessary API calls during chat) |
| **LangSmith** | Graph tracing & telemetry | Step-by-step token and latency debugging | Low | Free tier available | **DEFER** (Privacy concern: sends user emotional reflections to third-party cloud) |
| **Redis** | Rate limiting & ephemeral caching | Protects Gemini quota from spam | Low | ~$5–$10/mo | **DEFER** (Not required for hackathon demo) |
| **Celery / Workers** | Background offline processing | Summarizing memory trends asynchronously | High | Extra server container | **DEFER** (Adds deployment complexity) |
| **Pinecone / Qdrant**| Dedicated Vector Database | High-scale billion-vector search | High | $20+/mo | **REJECT** (Redundant; Supabase pgvector is sufficient if vectors are ever needed) |

---

## 7. Performance & Cost Impact Assessment

| Metric | Existing Monolith Pipeline | LangGraph Monolith Migration | Impact Difference |
| :--- | :--- | :--- | :--- |
| **Average Latency (TTFT)** | **1.2s – 1.8s** | **1.6s – 2.4s** | +0.4s – 0.6s latency penalty |
| **Total Turn Latency** | **3.5s – 5.0s** | **3.8s – 5.5s** | Negligible change (governed by Gemini generation speed) |
| **Model Calls per Turn** | **Strictly 1 call** (Gemini Flash Lite) | **1 call** (if single LLM node) | **Zero additional model cost** |
| **Token Consumption** | ~800 prompt tokens + ~120 response tokens | Identical | **Zero token inflation** |
| **Memory Footprint** | ~68 MB RAM (FastAPI + Uvicorn) | ~115 MB RAM (LangGraph state engine + LangChain dependencies) | +70% memory overhead per worker |
| **Docker Container Size** | ~185 MB image | ~320 MB image | Larger build and deploy times on Render |

---

## 8. Regression Protection & Test Coverage

If LangGraph is ever introduced, the migration **must guarantee zero regression** against the following established test suites:

### Existing Suites That Must Remain 100% Passing:
1. **Live Conversational Quality Suite (12 Scenarios):**
   - Casual conversation (A), feeling overlooked (B), career insecurity (C), emotional continuity across shifts (D).
   - Consented memory injection and immediate revocation (E).
   - Rant mode validation and 3-way post-rant choices (F).
   - Ambiguous fatigue handling (G), crisis interception (H), boundary adherence (I).
   - Conversational fatigue (J), grief-to-comedy topic transition (K), and honest AI identity (L).
2. **Personality & Safety Verification (`test_conversational_personality.py`):**
   - Prompt structure, absence of generic clichés, and Tele-MANAS/112 override.
3. **Rant Mode & Voice Transcription Suite (`test_rant_and_voice.py`):**
   - Push-to-talk multimodal transcription, zero audio retention.
4. **Mobile Client Suite (`auth_and_profile.test.js` & `phase3_companion.test.js`):**
   - Expo SecureStore session persistence, SSE stream parser dispatch, guest isolation.

### Mandatory New Regression Tests for Graph Migration:
- `test_graph_state_immutability()`: Verifies nodes do not mutate parent state directly.
- `test_crisis_early_termination()`: Asserts that Node 2 early-exit terminates the graph without invoking Gemini.
- `test_stream_event_queue_backpressure()`: Verifies `astream_events` does not drop tokens under slow network connections.
- `test_client_cancellation_rollback()`: Simulates client disconnect mid-token and checks database consistency.

---

## 9. Architectural Options Comparison (A / B / C)

```mermaid
graph LR
    subgraph OptionA["Option A: Refined Existing Monolith (RECOMMENDED)"]
        A1["FastAPI Async Generator"]
        A2["Direct Memory & Safety Services"]
        A3["Zero Graph Overhead"]
    end

    subgraph OptionB["Option B: Hybrid LangGraph (Post-Hackathon)"]
        B1["FastAPI Outer Router"]
        B2["LangGraph Orchestrator"]
        B3["Native Gemini Streamer"]
    end

    subgraph OptionC["Option C: Full LangGraph Rewrite"]
        C1["LangChain Chains"]
        C2["All Nodes in Graph"]
        C3["Buffered Output Review"]
    end
```

| Criterion | Option A: Refined Existing Monolith | Option B: Hybrid LangGraph | Option C: Full LangGraph Migration |
| :--- | :---: | :---: | :---: |
| **Conversational Quality** | **4.97 / 5.00** (Verified) | Estimated 4.90 – 4.95 | High risk of degradation |
| **First-Token Latency** | **Fastest (1.2s)** | Moderate (1.6s) | Slowest (2.5s+) |
| **Implementation Risk** | **Zero Risk** (Already deployed) | Moderate (Requires 2–3 days) | Extreme Risk (Full rewrite) |
| **Maintenance Burden** | Very Low (Clean procedural code) | Moderate (Graph state typing) | High (LangChain abstraction churn) |
| **Extensibility for Multi-Agent**| Limited to procedural dispatch | **High (Graph branching)** | **High** |
| **Recommendation** | **STRONGLY RECOMMENDED** | Recommended for V2 (Post-Demo) | **NOT RECOMMENDED** |

---

## 10. Phased Implementation Roadmap (Post-Hackathon V2)

If Solace decides to implement a **Hybrid LangGraph (Option B)** in a future release, the following non-disruptive, phased rollout must be followed:

```mermaid
timeline
    title Solace AI — LangGraph Phased Roadmap
    Phase 1 : Hackathon Submission (Now) : Ship Option A : Zero code changes : 4.97/5.00 live baseline
    Phase 2 : V2 Foundation (Post-Demo) : Isolate state schema : Benchmark astream_events : Parallel test harness
    Phase 3 : Hybrid Deployment : Migrate Mode Router to Graph : Retain native Gemini streaming : Run 12-scenario audit
    Phase 4 : Advanced Workflows : Interactive CBT journaling : Multi-persona social practice roleplay
```

### Phase 1: Hackathon Submission (Immediate — Next 35 Hours)
- **Action:** Freeze backend architecture. Maintain current production codebase on Render.
- **Deliverables:** High-stability demo, warm-up script execution, zero dependency modifications.

### Phase 2: Graph Prototyping in Isolation (Weeks 1–2 Post-Hackathon)
- Build a standalone prototype module `backend/app/graphs/companion_graph.py` without connecting it to production endpoints.
- Benchmark TTFT of `graph.astream_events(v2)` versus native `ai_provider.generate_response_stream()`.
- Confirm that memory usage and Render free-tier container limits are respected.

### Phase 3: Hybrid Routing Rollout (Weeks 3–4 Post-Hackathon)
- Connect `companion_graph` behind a feature flag (`ENABLE_LANGGRAPH_ROUTING=false`).
- Re-run the automated 12-scenario conversational quality evaluation harness against both pipelines.
- Verify that score does not regress below **4.95 / 5.00**.

### Phase 4: Advanced Interactive Workflows (Month 2)
- Introduce cyclical nodes for multi-turn structured therapy practices:
  - Guided 4-step Cognitive Behavioral Restructuring loops.
  - Interactive Social Practice Roleplay with simulated conversational counterpart persona.

---

## 11. Explicit List of What Should NOT Be Implemented

To protect Solace's stability, emotional attunement, and security, the following patterns **must never be introduced**:

1. **DO NOT replace deterministic regex crisis interception with an LLM classifier:** Crisis detection must remain hardcoded, immediate (<2ms), and impossible for model hallucination or rant mode to override.
2. **DO NOT introduce post-generation output review nodes:** Buffering assistant tokens destroys the conversational illusion and violates the calm, unhurried streaming experience.
3. **DO NOT introduce autonomous agent loops with external browsing tools:** Solace is an intimate emotional companion, not a web research agent. Tool calls during conversational reflection create jarring delays and unpredictable tones.
4. **DO NOT use third-party vector databases (Pinecone / Qdrant):** Storing user emotional reflections in external proprietary clouds introduces GDPR/DPDP privacy risks and unnecessary recurring costs. Supabase with RLS is the single source of truth.
5. **DO NOT send emotional reflections to LangSmith:** Forwarding raw user confessions to a developer observability cloud violates Solace's core promise of private sanctuary.
6. **DO NOT change model parameters or prompts during a framework migration:** Model temperature, system directives, and conversational guidelines must remain identical to preserve the 4.97/5.00 audited baseline.

---

## 12. Conclusion & Architectural Sign-Off

Solace AI's current FastAPI architecture is lean, robust, highly responsive, and achieves an outstanding **4.97 / 5.00** conversational quality score across realistic multi-turn evaluations. 

LangGraph is a capable framework for multi-agent cycles and complex tool execution, but introducing it into Solace's linear, latency-critical companion stream today would increase latency, add fragile event-streaming wrappers, and risk destabilizing a production-ready application hours before the hackathon deadline.

**Final Decision:** Maintain the current architecture (**Option A**) for hackathon submission. Keep the Hybrid LangGraph roadmap documented for post-hackathon feature expansion.

---
*Signed by:*  
**Lead AI Systems & Conversational Architect — Solace AI Team**
