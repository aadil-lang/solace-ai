import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.abspath("screenshots")
COLLAGE_PATH = os.path.join(OUT_DIR, "solace_complete_walkthrough_collage.png")

# Screen mappings for the 3x3 grid:
SCREENS = [
    # Row 1: Auth & Onboarding Flow
    ("05_login_clean.png", "1. Welcome & Sign In", "Clean typography, guest option, clear action"),
    ("06_signup_clean.png", "2. Account Registration", "Validation, privacy guarantee, direct sign in"),
    ("01_current.png", "3. Guest Experience (Home)", "Immediate access, 6 core somatic mood states"),
    
    # Row 2: Sanctuary & Authenticated Experience
    ("02_companion_guest.png", "4. Guest Sanctuary Gate", "Gentle boundary protecting private memory"),
    ("08_authenticated_home.png", "5. Authenticated Home", "Personalized greeting, dynamic check-in card"),
    ("10_companion_authenticated.png", "6. Solace AI Companion", "Unlocked sanctuary with reflective starters"),
    
    # Row 3: Mindfulness & Consent Memory
    ("12_discover_tab.png", "7. Mindfulness & Practices", "Categorized somatic grounding exercises"),
    ("13_box_breathing_modal.png", "8. Interactive Box Breathing", "4-4-4-4 parasympathetic nerve regulator"),
    ("14_authenticated_profile.png", "9. Consent Memory & Profile", "Verified user, memory toggle & preferences"),
]

# Dimensions
SCREEN_W = 480
SCREEN_H = 1067  # 1080x2400 scaled down (1066.6 -> 1067)
MARGIN_X = 60
MARGIN_Y = 60
GAP_X = 50
GAP_Y = 60
HEADER_H = 180
LABEL_H = 70

COLS = 3
ROWS = 3

TOTAL_W = MARGIN_X * 2 + COLS * SCREEN_W + (COLS - 1) * GAP_X
TOTAL_H = MARGIN_Y * 2 + HEADER_H + ROWS * (SCREEN_H + LABEL_H + GAP_Y) - GAP_Y

print(f"Creating collage: {TOTAL_W} x {TOTAL_H}")

# Background color: Warm stone / serene linen (#F5F4EE)
BG_COLOR = (245, 244, 238)
collage = Image.new("RGB", (TOTAL_W, TOTAL_H), BG_COLOR)
draw = ImageDraw.Draw(collage)

# Try loading standard system fonts
try:
    title_font = ImageFont.truetype("arialbd.ttf", 46)
    subtitle_font = ImageFont.truetype("arial.ttf", 26)
    card_title_font = ImageFont.truetype("arialbd.ttf", 24)
    card_sub_font = ImageFont.truetype("arial.ttf", 18)
except:
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()
    card_title_font = ImageFont.load_default()
    card_sub_font = ImageFont.load_default()

# 1. Draw Header
# Dark forest green (#2D3B32)
HEADER_TEXT_COLOR = (45, 59, 50)
SUBTITLE_COLOR = (100, 115, 105)

draw.text((MARGIN_X, MARGIN_Y + 15), "Solace AI  —  \"A little space to feel understood.\"", fill=HEADER_TEXT_COLOR, font=title_font)
draw.text((MARGIN_X, MARGIN_Y + 75), "End-to-End Android Pixel 7 Verification Walkthrough  •  Supabase Auth, Gemini AI Companion & Somatic Grounding", fill=SUBTITLE_COLOR, font=subtitle_font)

# Decorative header rule
draw.line([(MARGIN_X, MARGIN_Y + 130), (TOTAL_W - MARGIN_X, MARGIN_Y + 130)], fill=(215, 218, 210), width=2)

# 2. Place screens
start_y = MARGIN_Y + HEADER_H

for idx, (filename, title, subtitle) in enumerate(SCREENS):
    r = idx // COLS
    c = idx % COLS
    
    x = MARGIN_X + c * (SCREEN_W + GAP_X)
    y = start_y + r * (SCREEN_H + LABEL_H + GAP_Y)
    
    # Draw label above screen
    draw.text((x + 4, y), title, fill=HEADER_TEXT_COLOR, font=card_title_font)
    draw.text((x + 4, y + 30), subtitle, fill=SUBTITLE_COLOR, font=card_sub_font)
    
    screen_y = y + LABEL_H
    
    # Load and resize screenshot
    img_path = os.path.join(OUT_DIR, filename)
    if os.path.exists(img_path):
        screen_img = Image.open(img_path).convert("RGBA")
        screen_img = screen_img.resize((SCREEN_W, SCREEN_H), Image.Resampling.LANCZOS)
        
        # Rounded corners & border for screen
        # Create a mask for rounded corners
        mask = Image.new("L", (SCREEN_W, SCREEN_H), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([(0, 0), (SCREEN_W - 1, SCREEN_H - 1)], radius=24, fill=255)
        
        # Paste with mask
        collage.paste(screen_img, (x, screen_y), mask)
        
        # Draw elegant subtle border around device screen
        draw.rounded_rectangle([(x, screen_y), (x + SCREEN_W - 1, screen_y + SCREEN_H - 1)], radius=24, outline=(205, 208, 200), width=2)
    else:
        # Placeholder if missing
        draw.rounded_rectangle([(x, screen_y), (x + SCREEN_W - 1, screen_y + SCREEN_H - 1)], radius=24, fill=(230, 230, 230), outline=(180, 180, 180))
        draw.text((x + 30, screen_y + 100), f"Missing: {filename}", fill=(100, 100, 100), font=card_title_font)

# Save high-res collage
collage.save(COLLAGE_PATH, "PNG", quality=95)
print(f"✓ Saved master walkthrough collage to {COLLAGE_PATH} (size: {os.path.getsize(COLLAGE_PATH)} bytes)")

