import os
import base64
import json

SCREENSHOTS_DIR = os.path.abspath("screenshots")
OUT_HTML_ROOT = os.path.abspath("gallery.html")
OUT_HTML_SCREENS = os.path.join(SCREENSHOTS_DIR, "index.html")

SCREENS_DATA = [
    {
        "id": "screen-01",
        "file": "05_login_clean.png",
        "category": "auth",
        "categoryLabel": "Authentication",
        "title": "Welcome & Sign In",
        "badge": "Entry Point",
        "description": "Minimalist, calming authentication screen with email and password inputs, instant guest access bypass, and real-time form validation.",
        "uxHighlights": [
            "Serene organic palette (#F7F6F0 background, #2D3B32 forest accents)",
            "Password visibility toggle and friendly validation feedback",
            "One-tap 'Explore as Guest' for zero-friction evaluation without registration"
        ],
        "techStack": "Supabase Auth (gotrue-js) • Expo SecureStore Token Persistence"
    },
    {
        "id": "screen-02",
        "file": "06_signup_clean.png",
        "category": "auth",
        "categoryLabel": "Authentication",
        "title": "Account Registration",
        "badge": "Onboarding",
        "description": "Privacy-focused account creation establishing user identity with password confirmation and explicit emotional data confidentiality guarantees.",
        "uxHighlights": [
            "Tactile input fields with subtle rounded borders",
            "Privacy reassurance note: 'Your reflections are encrypted and private'",
            "Seamless return link to Sign In with Android gesture-bar safe padding"
        ],
        "techStack": "Supabase PostgreSQL auth.users • RLS Row-Level Security Isolation"
    },
    {
        "id": "screen-03",
        "file": "01_current.png",
        "category": "guest",
        "categoryLabel": "Guest Experience",
        "title": "Guest Sanctuary (Home)",
        "badge": "Zero Barriers",
        "description": "Immediate access to Solace's core tactile check-in experience without requiring credentials. Local state persists on device only.",
        "uxHighlights": [
            "Tactile 6-mood somatic grid: Peaceful, Grateful, Reflective, Anxious, Heavy, Hopeful",
            "Guest Session badge indicating local unlinked session",
            "Quick-launcher card to initiate companion reflection"
        ],
        "techStack": "Zustand useAuthStore & useCheckInStore • Local Device Cache"
    },
    {
        "id": "screen-04",
        "file": "02_companion_guest.png",
        "category": "guest",
        "categoryLabel": "Guest Experience",
        "title": "Guest Sanctuary Gate",
        "badge": "Privacy Boundary",
        "description": "Thoughtful boundary screen explaining that private persistent emotional memory and cloud sessions require authenticated identity.",
        "uxHighlights": [
            "Clear, non-punitive value proposition for registration",
            "Three core benefits: Real-time AI dialogue, consent-based memory, multi-device sync",
            "Alternative pathway: 'Explore local grounding practices in Discover'"
        ],
        "techStack": "Expo Router Protected Routes • Graceful Feature Gating"
    },
    {
        "id": "screen-05",
        "file": "08_authenticated_home.png",
        "category": "authenticated",
        "categoryLabel": "Authenticated Sanctuary",
        "title": "Authenticated Home",
        "badge": "Daily Sanctuary",
        "description": "Personalized daily emotional anchor welcoming the authenticated user with dynamic time-of-day greetings and tactile check-in tracking.",
        "uxHighlights": [
            "Personalized header greeting ('Good evening, Friend' / user's preferred name)",
            "Dynamic daily check-in prompt with intensity slider and reflective journaling",
            "Companion launcher card inviting user to unpack thoughts"
        ],
        "techStack": "FastAPI Check-ins API • Supabase RLS policies • TanStack Query"
    },
    {
        "id": "screen-06",
        "file": "10_companion_authenticated.png",
        "category": "authenticated",
        "categoryLabel": "Authenticated Sanctuary",
        "title": "Solace AI Companion",
        "badge": "Live Reflection",
        "description": "Unlocked conversational sanctuary featuring empathetic suggested starters, compassionate tone, and real-time streaming dialogue.",
        "uxHighlights": [
            "Four curated reflective prompts (restless thoughts, unsettled moments, grounding, small wins)",
            "'Holding space for you' reassuring companion status indicator",
            "Floating mindful input composer with gentle placeholder"
        ],
        "techStack": "Google Gemini 2.5/3.5 Flash • Server-Sent Events (SSE) • Tele-MANAS Safety"
    },
    {
        "id": "screen-07",
        "file": "11_companion_streamed_reply.png",
        "category": "authenticated",
        "categoryLabel": "Authenticated Sanctuary",
        "title": "Streaming AI Conversation",
        "badge": "Live Streaming",
        "description": "Real-time SSE token stream delivering gentle, non-judgmental reflective inquiry brokered securely through the FastAPI backend.",
        "uxHighlights": [
            "Distinct conversational bubbles (Forest green user bubble, warm stone companion bubble)",
            "'Listening and reflecting...' animated typing state",
            "Zero client-side API keys — all model requests strictly brokered via backend"
        ],
        "techStack": "FastAPI SSE Streaming • Uvicorn ASGI • Token-by-token Chunking"
    },
    {
        "id": "screen-08",
        "file": "12_discover_tab.png",
        "category": "somatic",
        "categoryLabel": "Mindfulness & Somatics",
        "title": "Mindfulness & Practices",
        "badge": "Evidence-Based",
        "description": "Categorized somatic grounding tools, nervous system regulation routines, and journaling exercises designed for acute tension relief.",
        "uxHighlights": [
            "Category filter chips: All, Breathing, Journaling, Grounding",
            "Exercise duration pills (3 min, 4 min, 5 min) for low-barrier engagement",
            "Clear physiological rationales (e.g., HRV regulation, adrenaline clearing)"
        ],
        "techStack": "Categorized Content Schema • Offline-capable Grounding Guides"
    },
    {
        "id": "screen-09",
        "file": "13_box_breathing_modal.png",
        "category": "somatic",
        "categoryLabel": "Mindfulness & Somatics",
        "title": "Guided Box Breathing",
        "badge": "Parasympathetic Reset",
        "description": "Interactive bottom-sheet modal guiding users through 4-4-4-4 equal-ratio breathing to stimulate vagal tone and restore calm.",
        "uxHighlights": [
            "Gentle bottom-sheet overlay with backdrop dimming",
            "Actionable posture guidance: 'Lower shoulders, soften gaze, natural pace'",
            "Prominent 'Start Guided Session' primary call-to-action"
        ],
        "techStack": "React Native Modal Bottom Sheet • Expo Haptics Pacing Support"
    },
    {
        "id": "screen-10",
        "file": "14_authenticated_profile.png",
        "category": "authenticated",
        "categoryLabel": "Authenticated Sanctuary",
        "title": "Consent Memory & Profile",
        "badge": "Radical Consent",
        "description": "Complete transparency and user sovereignty over AI memory. Users can view, toggle, export, or permanently purge saved emotional insights.",
        "uxHighlights": [
            "Verified user badge ('🛡️ Supabase Authenticated')",
            "Global Emotional Memory Master Toggle with clear consent notice",
            "Mindful Preferences: Interaction tone ('Gentle & Empathetic') & Wellness Goals"
        ],
        "techStack": "Supabase profiles & memories tables • RLS delete/update cascade"
    },
    {
        "id": "screen-11",
        "file": "solace_complete_walkthrough_collage.png",
        "category": "collage",
        "categoryLabel": "Master Collage",
        "title": "Complete Walkthrough Collage",
        "badge": "3x3 Master Grid",
        "description": "High-resolution 1660x3831 compilation showcasing the complete verified journey across authentication, guest mode, AI dialogue, and grounding.",
        "uxHighlights": [
            "Comprehensive presentation poster summarizing all key device screens",
            "Pixel-perfect typography, device frames, and descriptive sub-labels",
            "Ideal asset for hackathon pitch decks, demo showcases, and design portfolios"
        ],
        "techStack": "Pillow (PIL) Image Composition • Android adb screencap automation"
    }
]

def encode_image(file_path):
    if not os.path.exists(file_path):
        return ""
    with open(file_path, "rb") as f:
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"

print("Encoding screenshots to base64...")
screens_json = []
for s in SCREENS_DATA:
    img_path = os.path.join(SCREENSHOTS_DIR, s["file"])
    data_uri = encode_image(img_path)
    screens_json.append({
        **s,
        "src": data_uri,
        "relativePath": f"./screenshots/{s['file']}"
    })
    print(f"✓ Encoded {s['file']} ({len(data_uri)} chars)")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solace AI — Mobile Verification & Screen Gallery</title>
  <style>
    :root {
      --bg: #F7F6F0;
      --surface: #FFFFFF;
      --card-bg: #FFFFFF;
      --text-main: #2D3B32;
      --text-muted: #647369;
      --text-subtle: #8A9A8F;
      --forest: #2D3B32;
      --forest-hover: #1E2822;
      --sage-light: #EAF1EB;
      --sage-border: #DCE3DD;
      --accent-warm: #E28458;
      --border: #E8ECE8;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --radius-full: 9999px;
      --shadow-sm: 0 2px 6px rgba(45, 59, 50, 0.04);
      --shadow-md: 0 8px 24px rgba(45, 59, 50, 0.08);
      --shadow-lg: 0 16px 40px rgba(45, 59, 50, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding: 32px 20px 80px 20px;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1360px;
      margin: 0 auto;
    }

    /* HEADER & HERO */
    .hero {
      text-align: center;
      margin-bottom: 40px;
      padding: 32px 20px 24px 20px;
    }

    .brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--sage-light);
      color: var(--forest);
      padding: 6px 14px;
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 16px;
      border: 1px solid var(--sage-border);
    }

    .hero-title {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 800;
      color: var(--forest);
      letter-spacing: -1px;
      line-height: 1.15;
      margin-bottom: 10px;
    }

    .hero-tagline {
      font-size: clamp(16px, 2.5vw, 20px);
      color: var(--text-muted);
      font-style: italic;
      margin-bottom: 24px;
    }

    /* QUICK STATUS CHIPS */
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-bottom: 30px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      color: var(--text-main);
      font-weight: 500;
      box-shadow: var(--shadow-sm);
    }

    .chip-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2E7D32;
    }

    /* ACTION BUTTONS */
    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 14px;
      margin-bottom: 48px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: var(--radius-full);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: var(--shadow-sm);
      border: none;
    }

    .btn-primary {
      background: var(--forest);
      color: #FFFFFF;
    }

    .btn-primary:hover {
      background: var(--forest-hover);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: var(--surface);
      color: var(--forest);
      border: 1px solid var(--sage-border);
    }

    .btn-secondary:hover {
      background: var(--sage-light);
      border-color: var(--text-muted);
      transform: translateY(-1px);
    }

    /* FILTER TABS */
    .filter-wrapper {
      display: flex;
      justify-content: center;
      margin-bottom: 36px;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: var(--surface);
      padding: 6px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }

    .filter-btn {
      padding: 8px 18px;
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 600;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .filter-btn.active {
      background: var(--forest);
      color: #FFFFFF;
      box-shadow: var(--shadow-sm);
    }

    .filter-btn:not(.active):hover {
      color: var(--text-main);
      background: var(--sage-light);
    }

    /* SCREENSHOTS GRID */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 32px;
    }

    /* Master collage special item takes full width */
    .grid-item.collage-item {
      grid-column: 1 / -1;
    }

    .card {
      background: var(--card-bg);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }

    /* MOCKUP CONTAINER */
    .mockup-wrap {
      background: #ECEBE4;
      padding: 24px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      position: relative;
    }

    .phone-frame {
      width: 100%;
      max-width: 280px;
      border-radius: 36px;
      background: #111;
      padding: 8px;
      box-shadow: 0 14px 28px rgba(0,0,0,0.18), 0 10px 10px rgba(0,0,0,0.12);
      position: relative;
      transition: transform 0.2s ease;
    }

    .phone-frame:hover {
      transform: scale(1.02);
    }

    .phone-screen {
      border-radius: 28px;
      overflow: hidden;
      background: #FFFFFF;
      display: block;
      line-height: 0;
    }

    .phone-screen img {
      width: 100%;
      height: auto;
      display: block;
      user-select: none;
    }

    /* Collage special frame */
    .collage-frame {
      width: 100%;
      max-width: 900px;
      border-radius: 20px;
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-md);
    }

    .collage-frame img {
      width: 100%;
      height: auto;
      display: block;
    }

    .click-zoom-hint {
      position: absolute;
      bottom: 12px;
      right: 16px;
      background: rgba(45, 59, 50, 0.85);
      color: #FFF;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 500;
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }

    .mockup-wrap:hover .click-zoom-hint {
      opacity: 1;
    }

    /* CARD INFO */
    .card-body {
      padding: 22px;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    .card-header-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .card-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      background: var(--sage-light);
      color: var(--forest);
    }

    .card-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--forest);
      margin-bottom: 8px;
    }

    .card-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .highlights-list {
      list-style: none;
      margin-bottom: 16px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }

    .highlights-list li {
      font-size: 12.5px;
      color: var(--text-main);
      margin-bottom: 6px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .highlights-list li::before {
      content: "•";
      color: var(--forest);
      font-weight: bold;
    }

    .card-footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      color: var(--text-subtle);
    }

    .inspect-btn {
      font-size: 12px;
      font-weight: 600;
      color: var(--forest);
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .inspect-btn:hover {
      text-decoration: underline;
    }

    /* LIGHTBOX MODAL */
    .lightbox {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(18, 24, 20, 0.92);
      backdrop-filter: blur(10px);
      z-index: 1000;
      display: none;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox-content {
      max-width: 95vw;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .lightbox-img-wrap {
      max-height: 80vh;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 14px;
    }

    .lightbox-img {
      max-height: 80vh;
      max-width: 88vw;
      border-radius: 18px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      object-fit: contain;
    }

    .lightbox-caption {
      color: #FFFFFF;
      text-align: center;
      max-width: 600px;
    }

    .lightbox-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .lightbox-sub {
      font-size: 13px;
      color: #CAD5CD;
    }

    .lightbox-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.15);
      color: #FFFFFF;
      border: none;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 22px;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: background 0.2s ease;
    }

    .lightbox-nav-btn:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    .lightbox-prev { left: 24px; }
    .lightbox-next { right: 24px; }

    .lightbox-close {
      position: absolute;
      top: 24px;
      right: 24px;
      background: rgba(255, 255, 255, 0.15);
      color: #FFF;
      border: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: background 0.2s ease;
    }

    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    /* FOOTER */
    footer {
      text-align: center;
      margin-top: 60px;
      color: var(--text-muted);
      font-size: 13px;
      border-top: 1px solid var(--border);
      padding-top: 28px;
    }

    footer a {
      color: var(--forest);
      text-decoration: none;
      font-weight: 600;
    }

    footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .lightbox-prev { left: 8px; }
      .lightbox-next { right: 8px; }
      .lightbox-nav-btn { width: 38px; height: 38px; font-size: 18px; }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- HERO -->
    <header class="hero">
      <div class="brand-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
        Solace AI • Android Pixel 7 Verification
      </div>
      <h1 class="hero-title">Solace Mobile Experience</h1>
      <p class="hero-tagline">"A little space to feel understood."</p>

      <div class="chips-row">
        <div class="chip"><span class="chip-dot"></span> Pixel 7 Live Emulator Verified</div>
        <div class="chip"><span class="chip-dot"></span> Supabase Auth & RLS Active</div>
        <div class="chip"><span class="chip-dot"></span> Google Gemini Live Streaming</div>
        <div class="chip"><span class="chip-dot"></span> EAS Build Standalone APK</div>
      </div>

      <div class="actions-bar">
        <a href="https://expo.dev/artifacts/eas/YZFgz1jEFCc7I7ZBaO5m262mV0R69NeDTaQXDW_sXYs.apk" target="_blank" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Android APK (90.7 MB)
        </a>

        <button onclick="openModalById('screen-11')" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          View Master 3x3 Collage
        </button>

        <a href="https://github.com/aadil-lang/solace-ai" target="_blank" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub Repository
        </a>
      </div>

      <!-- FILTER TABS -->
      <div class="filter-wrapper">
        <div class="filters">
          <button class="filter-btn active" onclick="filterScreens('all', this)">All Screens (11)</button>
          <button class="filter-btn" onclick="filterScreens('auth', this)">Authentication (2)</button>
          <button class="filter-btn" onclick="filterScreens('guest', this)">Guest Mode (2)</button>
          <button class="filter-btn" onclick="filterScreens('authenticated', this)">Sanctuary & AI (4)</button>
          <button class="filter-btn" onclick="filterScreens('somatic', this)">Mindfulness & Somatics (2)</button>
          <button class="filter-btn" onclick="filterScreens('collage', this)">Master Collage (1)</button>
        </div>
      </div>
    </header>

    <!-- GRID -->
    <main class="grid" id="screens-grid">
      <!-- Dynamic render via JS -->
    </main>

    <!-- FOOTER -->
    <footer>
      <p>Solace AI • Built with Expo SDK 58, FastAPI, Supabase & Google Gemini</p>
      <p style="margin-top: 6px;">
        <a href="https://github.com/aadil-lang/solace-ai" target="_blank">View GitHub Monorepo</a> • 
        <a href="https://solace-ai-p2ft.onrender.com/health" target="_blank">Backend Health Endpoint</a>
      </p>
    </footer>
  </div>

  <!-- LIGHTBOX MODAL -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
    <button class="lightbox-nav-btn lightbox-prev" onclick="prevScreen(event)">&#10094;</button>
    <button class="lightbox-nav-btn lightbox-next" onclick="nextScreen(event)">&#10095;</button>

    <div class="lightbox-content" onclick="event.stopPropagation()">
      <div class="lightbox-img-wrap">
        <img src="" alt="" class="lightbox-img" id="lightbox-img">
      </div>
      <div class="lightbox-caption">
        <div class="lightbox-title" id="lightbox-title"></div>
        <div class="lightbox-sub" id="lightbox-sub"></div>
      </div>
    </div>
  </div>

  <script>
    const screens = %SCREENS_JSON%;
    let currentFilter = 'all';
    let currentIndex = 0;

    function renderGrid() {
      const grid = document.getElementById('screens-grid');
      grid.innerHTML = '';

      const filtered = screens.filter(s => currentFilter === 'all' || s.category === currentFilter);

      filtered.forEach((s, idx) => {
        const item = document.createElement('div');
        const isCollage = s.category === 'collage';
        item.className = 'grid-item' + (isCollage ? ' collage-item' : '');
        
        const highlightsHtml = s.uxHighlights.map(h => `<li>${h}</li>`).join('');

        item.innerHTML = `
          <div class="card">
            <div class="mockup-wrap" onclick="openModal('${s.id}')">
              ${isCollage ? `
                <div class="collage-frame">
                  <img src="${s.src}" alt="${s.title}" loading="lazy">
                </div>
              ` : `
                <div class="phone-frame">
                  <div class="phone-screen">
                    <img src="${s.src}" alt="${s.title}" loading="lazy">
                  </div>
                </div>
              `}
              <div class="click-zoom-hint">Click to enlarge</div>
            </div>
            <div class="card-body">
              <div class="card-header-line">
                <span class="card-badge">${s.badge}</span>
                <span style="font-size: 11px; color: var(--text-subtle);">${s.categoryLabel}</span>
              </div>
              <h3 class="card-title">${s.title}</h3>
              <p class="card-desc">${s.description}</p>
              
              <ul class="highlights-list">
                ${highlightsHtml}
              </ul>

              <div class="card-footer">
                <span>${s.techStack}</span>
                <button class="inspect-btn" onclick="openModal('${s.id}')">
                  Expand
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
        grid.appendChild(item);
      });
    }

    function filterScreens(cat, btn) {
      currentFilter = cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    }

    function openModal(id) {
      const idx = screens.findIndex(s => s.id === id);
      if (idx !== -1) {
        currentIndex = idx;
        updateModal();
        document.getElementById('lightbox').classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function openModalById(id) {
      openModal(id);
    }

    function updateModal() {
      const s = screens[currentIndex];
      const img = document.getElementById('lightbox-img');
      img.src = s.src;
      img.alt = s.title;
      document.getElementById('lightbox-title').innerText = `${s.title} (${s.badge})`;
      document.getElementById('lightbox-sub').innerText = s.description;
    }

    function closeLightbox(e) {
      if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
      document.getElementById('lightbox').classList.remove('active');
      document.body.style.overflow = '';
    }

    function prevScreen(e) {
      if (e) e.stopPropagation();
      currentIndex = (currentIndex - 1 + screens.length) % screens.length;
      updateModal();
    }

    function nextScreen(e) {
      if (e) e.stopPropagation();
      currentIndex = (currentIndex + 1) % screens.length;
      updateModal();
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      const lb = document.getElementById('lightbox');
      if (!lb.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevScreen();
      if (e.key === 'ArrowRight') nextScreen();
    });

    renderGrid();
  </script>
</body>
</html>
"""

final_html = HTML_TEMPLATE.replace("%SCREENS_JSON%", json.dumps(screens_json))

with open(OUT_HTML_ROOT, "w", encoding="utf-8") as f:
    f.write(final_html)
print(f"✓ Saved sharable gallery to: {OUT_HTML_ROOT} ({len(final_html)} bytes)")

with open(OUT_HTML_SCREENS, "w", encoding="utf-8") as f:
    f.write(final_html)
print(f"✓ Saved sharable gallery to: {OUT_HTML_SCREENS} ({len(final_html)} bytes)")

# Also copy to artifacts directory for inline chat viewing
ARTIFACT_DIR = r"C:\Users\HP\.gemini\antigravity\brain\849ca8be-508e-4c05-aa5d-2ff56d0645fd"
ARTIFACT_HTML = os.path.join(ARTIFACT_DIR, "gallery.html")
with open(ARTIFACT_HTML, "w", encoding="utf-8") as f:
    f.write(final_html)
print(f"✓ Saved artifact gallery to: {ARTIFACT_HTML}")

