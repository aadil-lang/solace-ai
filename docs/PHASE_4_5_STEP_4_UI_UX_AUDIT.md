# Solace AI — Phase 4.5, Step 4: UI/UX Consistency & Visual Polish Audit
**Document:** `docs/PHASE_4_5_STEP_4_UI_UX_AUDIT.md`  
**Milestone:** Phase 4.5, Step 4 (Stage 1 — Read-Only Product Experience Audit)  
**Inspection Date:** November 9, 2026  
**Target Environment:** Android Pixel 7 Emulator (`emulator-5554`), Android 16 (API 36)  
**Baseline Git Commit:** `4385b76`  
**Scope:** Read-Only Visual & Interaction Audit (Zero application code or style modifications)

---

## 1. Executive Summary

Solace AI has evolved through four major functional milestones (LangGraph orchestration, Words of Solace, Voice Journal, and Emotional Landscape). The underlying engineering architecture, local persistence, offline state machines, and Supabase RLS isolation are verified and stable.

However, from a user experience standpoint, the application reflects its incremental development history:
1. **Visual Cohesion**: The core aesthetic—warm linen off-white (`#F8F6F1`), grounding forest pine (`#34483D`), and soft sage accents (`#A8B9A0`)—is strong, distinctive, and emotionally calming. However, modal headers, card borders, and icon conventions drift between features.
2. **Modal Header Asymmetry**: In `PoetryModal` and `VoiceJournalModal`, the close button is positioned on the **top right**, whereas in `EmotionalLandscapeModal`, it is positioned on the **top left**. This contradicts muscle memory.
3. **Profile vs Sanctuary**: The Profile screen displays consumer settings alongside technical developer telemetry (e.g. raw Render URLs and telemetry test buttons), while missing direct shortcuts to the user's saved poetry, voice reflections, and landscape horizons.
4. **Destructive Action Guards**: Deleting moments from Horizon or discarding an active journal draft occurs without an explicit confirmation prompt.
5. **Touch Target Padding**: Certain icon-only buttons (close icons, bookmark stars, trash cans) have bounding boxes below the recommended 48×48 dp minimum without explicit `hitSlop`.

This audit catalogs every visual, layout, and interaction issue across all 4 primary tabs and 4 modal experiences, prioritizing them into an actionable, incremental polish plan without wholesale redesign.

---

## 2. Existing Design-System Overview

Solace defines its foundational design tokens in [`mobile/constants/theme.ts`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/constants/theme.ts):

| Token Category | Tokens Defined | Actual Application Usage | Visual Parity & Drift |
| :--- | :--- | :--- | :--- |
| **Colors** | `background` (#F8F6F1)<br>`surface` (#FFFFFF)<br>`surfaceMuted` (#F2EFE9)<br>`forest` (#34483D)<br>`sage` (#A8B9A0)<br>`text` (#30332F)<br>`textSecondary` (#636A63)<br>`textMuted` (#8D968D) | Used consistently across Home, Discover, and Profile. Rant Mode introduces terracotta (`#B85D3B`). | **Consistent**. High color fidelity and serene natural tone. |
| **Typography** | Sizes: `xs` (12), `sm` (14), `md` (16), `lg` (18), `xl` (22), `xxl` (28), `display` (34).<br>Weights: 400, 500, 600, 700. | Headings range from 28 to 34px. Body text sits comfortably at 14–16px. | **Minor drift**: Some screen titles use 26px or 28px ad-hoc; `fontFamily` relies on system sans-serif. |
| **Spacing** | `xs` (4), `sm` (8), `md` (16), `lg` (24), `xl` (32), `xxl` (40). | 16px horizontal margins (`theme.spacing.md`) and 24px card padding (`theme.spacing.lg`). | **Consistent** across tabs. |
| **Radii** | `sm` (8), `md` (14), `lg` (20), `xl` (28), `full` (9999). | Cards use 14px or 20px; chips use `full` (9999). | **Minor drift**: Some cards use `md` (14px) while adjacent cards use `lg` (20px). |
| **Shadows** | `soft` (elevation 2), `card` (elevation 3). | Applied to elevated cards and bottom tab bar. | **Consistent**. Restrained, subtle elevation that avoids heavy material drop shadows. |

---

## 3. Screen-by-Screen Findings

### A. Tab Bar Layout ([`_layout.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/_layout.tsx))
- **Visual Hierarchy**: 4 evenly spaced tabs: Home, Companion, Discover, Profile.
- **Active State**: Active tab shifts to `theme.colors.forest` with filled icon (`home`, `sparkles`, `compass`, `person`). Inactive tabs use `textMuted` with outline icons.
- **Android System Bar**: Tab bar height is 72dp with 14dp bottom padding, safely accommodating the Android gesture navigation pill.
- **Observed Polish Opportunity**: On screens with 360–390dp width, the tab label text (11px) has tight margins on the rightmost `Profile` tab. Adding 2px horizontal padding to the bar avoids truncation on small screens.

---

### B. Home Tab ([`index.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/index.tsx))

| Component / Section | Visual & UX Findings | Impact |
| :--- | :--- | :--- |
| **Header Greeting** | Displays `"Good evening, test_rls_landscape_a."`. When display name is a generated ID or email, the greeting wraps awkwardly across 2 lines. | Low |
| **Mood Check-in Card** | 2×3 grid of mood chips (`Peaceful`, `Grateful`, `Reflective`, `Anxious`, `Heavy`, `Hopeful`). Each mood has a distinct soothing pastel tint (`#E8F1EB`, `#FAF0E6`, etc.). Intensity selector (1–5) provides immediate visual feedback. | **High Polish** |
| **Saved for Today State** | When check-in is saved, displays a green pill `✓ Saved for Today` alongside a small text button `Update`. The pill looks like an interactive button but is non-clickable, causing confusion. | Moderate |
| **Companion Promo Banner** | Pine green background with leaf motif: `"I'm here whenever you need a moment."` and CTA `Start Mindful Conversation`. Directly transitions user to Companion tab. | **High Polish** |
| **Daily Reflection Card** | Subdued card displaying daily contemplative quote. High readability and calm presence. | **High Polish** |
| **Reflection History (Section F)** | Shows total check-ins count, latest mood badge, and recent entries row. Contains `Explore Landscape →` shortcut opening the Landscape modal. | **High Polish** |

---

### C. Companion Tab ([`companion.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/companion.tsx))

| Component / Section | Visual & UX Findings | Impact |
| :--- | :--- | :--- |
| **Empty State & Starters** | Centered calm icon, welcome message, and 4 suggested starter chips. The 4 chips are stacked vertically, pushing the input bar close to the bottom on smaller screen heights. | Moderate |
| **Rant Mode Transition** | Tapping `Let It Out` transitions the header to `Just Let It Out`, subtitle to `Listening freely • No advice or fixing`, and button to `Exit Mode`. Theme color shifts to warm terracotta (`#B85D3B`). | **High Polish** |
| **TTS Audio Bar** | When speech is active, a status bar appears with `Stop` button. Tapping the top-right TTS toggle changes icon without an explanatory toast. | Low |
| **Error Notice Bar** | Renders warm amber notice bar above input bar: `"We couldn't confirm whether your message was sent. Check the conversation before trying again."`. Blind retry is suppressed; dismiss icon (`✕`) is available. | **Verified Safe** |
| **Input Bar & Send Button** | Floating pill with mic icon, text area, and send button (`send` icon). Send button remains disabled when input is whitespace. | **High Polish** |

---

### D. Discover Tab ([`discover.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/discover.tsx))

| Component / Section | Visual & UX Findings | Impact |
| :--- | :--- | :--- |
| **Featured Hero Cards** | 3 stacked cards for Words of Solace, Voice Journal, and Emotional Landscape. Generous typography, subtle elevation, and clear category chips. | **High Polish** |
| **Card Action Icons** | Hero cards use different icons on the right: book icon for Poetry, mic icon for Journal, compass icon for Landscape. They convey feature domain, but lack a clear chevron indicating tap-to-open. | Low |
| **Practice Filter Chips** | `All`, `Breathing`, `Journaling`, `Grounding` horizontal pill selector. Active state is forest green with white text. | **High Polish** |
| **Grounding Practice Cards** | Cards for Box Breathing, 4-7-8, Thought Release, Gratitude, and 5-4-3-2-1. Tapping Box Breathing opens the interactive visualizer. | **High Polish** |

---

### E. Profile Tab ([`profile.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/profile.tsx))

| Component / Section | Visual & UX Findings | Impact |
| :--- | :--- | :--- |
| **User Identity Card** | Circular avatar, user email, and green `Supabase Authenticated` badge. | **High Polish** |
| **Greeting Name Editor** | Shows preferred name with `Edit` action opening an inline prompt. | Good |
| **Emotional Memory Section** | Shows memory count (`0 memories saved`), `Add Memory` button, and calm empty state card explaining consent. | **High Polish** |
| **Backend Telemetry Card** | Displays `Backend Telemetry`, status pill, `Test Backend Connection` button, and raw Render URL (`https://solace-ai-p2ft.onrender.com`). Exposes internal API infrastructure to everyday wellness users. | **Needs Polish** |
| **Archive Shortcuts Missing** | Profile has no links to "Saved Poetry", "Voice Journal Archives", or "Saved Reflections". Users must remember to open Discover modals to find past entries. | Moderate |
| **Sign Out Action** | Red/terracotta ghost button `Sign Out of Solace`. Clean confirmation and haptic feedback. | Good |

---

## 4. Feature-Journey Findings (Modals & Sub-Flows)

### A. Words of Solace ([`PoetryModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/PoetryModal.tsx))
1. **Modal Header**: Top-right close button (`✕`), calm header and subtitle.
2. **Tab Switcher**: Segmented pills for `Compose` and `Saved Words (N)`. High contrast and smooth switching.
3. **Script & Theme Selection**: 2×2 script grid (`English`, `اردو`, `Bilingual`, `Roman Urdu`) and 8 theme chips with individual icons.
4. **Poem Presentation**: Renders Nastaliq Urdu with proper RTL text direction and right-alignment. Action row provides `Copy`, `Save to Sanctuary`, and `New Verses`.
5. **Saved Archive**: Expands poem cards on tap, displaying full verses, timestamp, format badge, and remove button.
6. **Polish Issues**:
   - Close button hitSlop is small (~36px).
   - Empty saved state is plain text without an illustrative visual.

### B. Voice Journal ([`VoiceJournalModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/VoiceJournalModal.tsx))
1. **Sanctuary Notice**: Ephemeral audio explanation card with shield icon reassures user that audio is purged immediately.
2. **Audio Recorder**: Circular 80px mic button, timer feedback, and honest permission denial handling.
3. **Draft Review**: Full transcript review area with character/word counter, title input, mood tags, and optional AI reflection toggle.
4. **Polish Issues**:
   - Tapping `Discard` on a typed draft discards immediately without confirmation.
   - Close button is on the top right (consistent with Poetry, but inconsistent with Landscape).

### C. Emotional Landscape ([`EmotionalLandscapeModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/EmotionalLandscapeModal.tsx))
1. **Atmospheric Analytics**: Time-window selector (`Past 7 Days`, `Past 30 Days`, `All Time`), Prevailing Season card (*"Moving through Hopeful waters"*), and percentage mood distribution.
2. **Horizon & Meaningful Tabs**: Horizon lists all check-ins with bookmark star and delete trash icons. Meaningful tab filters to starred moments.
3. **Contemplative Reflection**: Generates non-clinical narrative reflection based exclusively on user's authorized check-ins.
4. **Polish Issues**:
   - **Header Close Button is on Top Left** (`x=73, y=192`), unlike Poetry and Journal which are on **Top Right** (`x=953`).
   - Trash icon deletes check-in immediately without a confirmation prompt.

### D. Box Breathing Visualizer ([`BoxBreathingVisualizer.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/BoxBreathingVisualizer.tsx))
- Half-screen bottom modal with guidance text and `Start Interactive Breathing` button.
- Smooth expanding/contracting circle synced with 4s inhale, 4s hold, 4s exhale, 4s hold.
- High visual appeal, peaceful pacing.

---

## 5. Loading, Empty, and Error-State Findings

| Screen / Feature | Initial Loading State | Empty State | Error / Offline State |
| :--- | :--- | :--- | :--- |
| **Home (Check-ins)** | Skeleton loading / spinner | Settle-in prompt: `"How are you feeling right now?"` | Local-first: check-ins save offline as `pending_sync` with reassuring notice. |
| **Companion Chat** | Thinking indicator: `"Listening and reflecting..."` | Welcome card with 4 mindful conversation starters. | Ambiguous delivery notice surfaces without blind retry; confirmed rejections offer Retry. |
| **Words of Solace** | Button shows spinner: `"Listening to silence..."` | Empty saved words: `"No saved poems yet"`. | API timeout message explains that local thoughts are safe. |
| **Voice Journal** | Spinner during AI reflection generation | Empty archive card: `"Your audio sanctuary is quiet"`. | Microphone permission denial honestly caught and explained without phantom timer. |
| **Emotional Landscape**| Loading spinner during analytics calculation | New guest empty state: `"Your landscape begins with your first moment"`. | Preserves offline check-ins; reflections generate only from authorized entries. |

---

## 6. Accessibility and Usability Findings

1. **Text Contrast (WCAG Compliance)**:
   - Deep slate `#30332F` on linen `#F8F6F1`: **11.4:1 (AAA)**.
   - Secondary text `#636A63` on `#F8F6F1`: **4.8:1 (AA)**.
   - Muted text `#8D968D` on `#F8F6F1`: **2.8:1** (below AA for small text; should be reserved for non-essential placeholder borders or upgraded to `#636A63`).
2. **Touch Targets**:
   - Primary buttons and tab bar exceed the 48×48dp minimum.
   - Modal close icons, card bookmark stars, and delete trash icons measure ~36–40dp and require `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}`.
3. **Text Scaling & Dynamic Type**:
   - Urdu Nastaliq text requires adequate line-height (`minHeight: 180px`, `lineHeight: 38px`) to prevent diacritic clipping. The current implementation preserves Nastaliq ascenders cleanly.
4. **Keyboard Avoidance**:
   - Handled via `KeyboardAvoidingView` on login and `keyboardShouldPersistTaps="handled"` on ScrollViews. Companion input bar remains visible during keyboard activation.

---

## 7. Screenshot Inventory

The following full-resolution screenshots were captured on `emulator-5554` (Pixel 7 Android 16 API 36) during this audit:

| Screenshot File | Screen / State | Key Elements Inspected |
| :--- | :--- | :--- |
| `audit_tab_home.png` | Home Tab (Upper) | Greeting, Mood Grid, Intensity 1–5, Saved Check-in badge |
| `audit_tab_home_scrolled.png` | Home Tab (Middle) | Solace Companion card, Daily Reflection, Practice list |
| `audit_tab_home_bottom.png` | Home Tab (Bottom) | Section F: Reflection History, Explore Landscape CTA |
| `audit_tab_companion.png` | Companion Tab | Solace Companion header, Rant banner, Starter chips, Input |
| `audit_companion_rant.png` | Companion Rant Mode | Terracotta theme, Free venting notice, Finished venting button |
| `audit_tab_discover.png` | Discover Tab | 3 Hero Cards (Poetry, Journal, Landscape), Filter chips |
| `audit_tab_profile.png` | Profile Tab (Upper) | User identity, Authenticated badge, Greeting editor, Memory card |
| `audit_tab_profile_scrolled.png` | Profile Tab (Bottom) | Mindful preferences, Backend Telemetry, Sign Out button |
| `audit_modal_poetry.png` | Words of Solace (Compose)| Script cards (English/Urdu/Bilingual/Roman), 8 Themes, Context |
| `audit_modal_poetry_saved.png` | Words of Solace (Saved) | Saved poem card preview, Nastaliq subtitle, delete icon |
| `audit_modal_poetry_expanded.png`| Words of Solace (Expanded) | Full Urdu poem, contemplative reflection, Copy/Remove actions |
| `audit_modal_journal.png` | Voice Journal (Sanctuary)| Ephemeral notice, 80px mic button, keyboard option |
| `audit_modal_journal_draft.png` | Voice Journal (Draft) | Review & Edit draft, title, mood chips, transcript editor |
| `audit_modal_landscape.png` | Landscape (Seasons) | Prevailing season, distribution percentages, intensity |
| `audit_modal_landscape_horizon.png`| Landscape (Horizon) | Check-in list, active bookmark stars, delete icons |
| `audit_modal_landscape_meaningful.png`| Landscape (Meaningful)| Filtered sanctuary moments, date, intensity meta |
| `audit_modal_breathing.png` | Box Breathing Visualizer | Guidance modal, rhythm instructions, start CTA |

---

## 8. Prioritized Issues

### Priority P0: Critical Usability & Data Safety Issues
- **None**. The app has no crashing routes, unhandled storage rejections, or duplicate-submission vulnerabilities.

### Priority P1: High-Impact Visual & Interaction Inconsistencies
1. **Issue P1-1: Modal Close Button Placement Drift**
   - *Observed Issue*: `EmotionalLandscapeModal` places the close button on the **top left** (`x=73`), while `PoetryModal` and `VoiceJournalModal` place it on the **top right** (`x=953`).
   - *Evidence*: `audit_modal_landscape.xml` line 1 vs `audit_modal_poetry.xml` line 4.
   - *User Impact*: Breaks user muscle memory; users tap the top right of Landscape and hit dead space.
   - *Proposed Correction*: Standardize all three feature modals to use the top-right close button with consistent icon (`close-outline`) and 48×48dp hitSlop.
2. **Issue P1-2: Destructive Deletion Without Confirmation Guard**
   - *Observed Issue*: Tapping the trash icon on a check-in in the Horizon tab or discarding a typed journal draft deletes/discards immediately without confirmation.
   - *Evidence*: `EmotionalLandscapeModal.tsx` `handleDeleteCheckIn(id)` directly calls `deleteCheckIn(id)` without `Alert.alert`.
   - *User Impact*: Accidental tap permanently removes an emotional check-in from the user's reflection history.
   - *Proposed Correction*: Add a gentle confirmation dialog: *"Remove this moment? This reflection will be gently released from your landscape."* with `Cancel` and `Remove`.
3. **Issue P1-3: Profile Screen Exposes Internal Technical Telemetry**
   - *Observed Issue*: Profile prominently displays raw Render URLs and a `Test Backend Connection` developer telemetry card.
   - *Evidence*: `audit_tab_profile_scrolled.png` lines 1491–1721.
   - *User Impact*: Degrades Solace's calm, non-clinical identity by surfacing developer debugging tools directly to wellness users.
   - *Proposed Correction*: Remove raw URL display from the consumer profile view and consolidate into a subtle, non-intrusive status pill (*"Sanctuary Connection: Grounded"*).

---

### Priority P2: Moderate Polish Issues
1. **Issue P2-1: Saved for Today Button Confusion on Home**
   - *Observed Issue*: The `✓ Saved for Today` pill looks like a primary button, but is non-interactive. The interactive action is a smaller `Update` text link next to it.
   - *Evidence*: `audit_tab_home.png` bounds=[126,1803][789,1943].
   - *User Impact*: Users tap `✓ Saved for Today` expecting to edit their check-in and receive no feedback.
   - *Proposed Correction*: Make the entire card or status badge interactive with a subtle pencil icon: `"Today's Check-in: Hopeful • Tap to update"`.
2. **Issue P2-2: Missing Direct Links to Saved Archives on Profile**
   - *Observed Issue*: Users who save poems, voice reflections, and meaningful landscape check-ins have no unified place on their Profile to view their archives.
   - *Evidence*: `profile.tsx` only lists Emotional Memories and Mindful Preferences.
   - *User Impact*: Saved content feels orphaned and hard to rediscover.
   - *Proposed Correction*: Add a clean `Your Saved Solace` card on Profile with 3 rows: `Saved Verses (N)`, `Voice Journals (N)`, `Meaningful Moments (N)`, each opening the respective modal tab.
3. **Issue P2-3: Starter Chips Stacking on Companion**
   - *Observed Issue*: 4 conversation starters are stacked vertically in full-width rows, occupying ~600px of screen height.
   - *Evidence*: `audit_tab_companion.xml` lines 1174–1778.
   - *User Impact*: Pushes content down and forces scrolling on smaller phone screens before the input bar can be seen.
   - *Proposed Correction*: Arrange starters into a 2-column compact grid or horizontal scrolling carousel.

---

### Priority P3: Minor Refinements
1. **Issue P3-1: System Clipboard Notice as Calm Toast**
   - *Observed Issue*: In preview builds without native clipboard, tapping Copy triggers a system `Alert.alert`.
   - *Proposed Correction*: Replace the OS alert dialog with a calm, self-dismissing inline toast banner matching Solace colors.
2. **Issue P3-2: Small Touch Targets on Modal Close Icons**
   - *Observed Issue*: Modal close buttons measure ~36px without `hitSlop`.
   - *Proposed Correction*: Add `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` to all header icon buttons.
3. **Issue P3-3: Card Border Radius Consistency**
   - *Observed Issue*: Some cards use `theme.radius.md` (14px) while others use `theme.radius.lg` (20px) on the same screen.
   - *Proposed Correction*: Standardize container cards to `theme.radius.lg` (20px) and inner nested cards to `theme.radius.md` (14px).

---

## 9. Recommended Corrections & Implementation Plan

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4.5 STEP 4 POLISH ROADMAP                        │
├──────────────────────────────────┬───────────────────────────┬─────────────┤
│ Issue & Correction               │ Affected Files            │ Complexity  │
├──────────────────────────────────┼───────────────────────────┼─────────────┤
│ 1. Standardize Modal Headers     │ EmotionalLandscapeModal   │ Small       │
│    (Move close icon to top-right,│ PoetryModal               │ (1-2 hours) │
│     add 48dp hitSlop)            │ VoiceJournalModal         │             │
├──────────────────────────────────┼───────────────────────────┼─────────────┤
│ 2. Destructive Action Guards     │ EmotionalLandscapeModal   │ Small       │
│    (Confirm dialog for check-in  │ VoiceJournalModal         │ (1 hour)    │
│     and draft deletion)          │                           │             │
├──────────────────────────────────┼───────────────────────────┼─────────────┤
│ 3. Profile Screen Polish         │ profile.tsx               │ Moderate    │
│    (Remove raw telemetry URLs;   │                           │ (2 hours)   │
│     add "Your Saved Solace" hub) │                           │             │
├──────────────────────────────────┼───────────────────────────┼─────────────┤
│ 4. Home Screen Check-In UX       │ index.tsx                 │ Small       │
│    (Unify Saved & Update states) │                           │ (1 hour)    │
├──────────────────────────────────┼───────────────────────────┼─────────────┤
│ 5. Companion Starters Layout     │ companion.tsx             │ Small       │
│    (2-column compact grid)       │                           │ (1 hour)    │
└──────────────────────────────────┴───────────────────────────┴─────────────┘
```

---

## 10. Components & Files Likely to be Affected

1. [`mobile/components/EmotionalLandscapeModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/EmotionalLandscapeModal.tsx): Standardize header layout, align close button to top-right, add delete confirmation.
2. [`mobile/components/VoiceJournalModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/VoiceJournalModal.tsx): Add discard confirmation, expand close button hitSlop.
3. [`mobile/components/PoetryModal.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/components/PoetryModal.tsx): Expand close button hitSlop, polish empty saved state.
4. [`mobile/app/(tabs)/profile.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/profile.tsx): Soften developer telemetry card, add links to Saved Poetry, Voice Journal, and Landscape archives.
5. [`mobile/app/(tabs)/index.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/index.tsx): Clean up Home check-in button hierarchy and greeting wrap.
6. [`mobile/app/(tabs)/companion.tsx`](file:///c:/Users/HP/OneDrive/Desktop/Solace%20AI/mobile/app/\(tabs\)/companion.tsx): Refine starter chips layout.

---

## 11. Explicit List of Things That Should NOT be Changed

To maintain stability, security, and project boundaries, the following components and subsystems are **out of bounds** for Step 4 polish:
1. **Zero Database / Schema Changes**: No modifications to Supabase tables, migrations, RLS policies, or database triggers.
2. **Zero Backend API Changes**: No modifications to FastAPI endpoints, LangGraph nodes, or AI service implementations.
3. **Zero State-Machine / Storage Changes**: The sync status model (`synced`, `pending_sync`, `local_only`), chunking logic, and SecureStore key sanitization must remain untouched.
4. **Zero Dependency Changes**: No upgrading, replacing, or adding npm packages or native libraries.
5. **Preserve Color Identity**: Do not alter the core brand palette (warm linen `#F8F6F1`, pine forest `#34483D`, sage `#A8B9A0`).
6. **No Feature Additions**: Do not implement Phase 5 features, voice synthesis generation, or new tabs.

---

## 12. Verification & Audit Conclusion

- **Audit Completion**: All 4 tabs, 4 feature modals, and Android layout states have been visually inspected and documented on `emulator-5554`.
- **Codebase Cleanliness**: Zero application code, styles, or configuration files were modified during this audit.
- **Repository State**: `main` remains clean at commit `4385b76`, synchronized with `origin/main`.
- **Next Step**: Await user review and authorization before implementing the prioritized polish items in Stage 2.

