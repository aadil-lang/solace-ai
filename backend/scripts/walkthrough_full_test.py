import subprocess
import os
import time

ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
OUT_DIR = os.path.abspath("screenshots")
os.makedirs(OUT_DIR, exist_ok=True)

def run(args):
    return subprocess.check_output([ADB] + args)

def tap(x, y, delay=1.5):
    print(f"Tapping ({x}, {y})")
    run(["shell", "input", "tap", str(x), str(y)])
    time.sleep(delay)

def key(k, delay=0.5):
    run(["shell", "input", "keyevent", str(k)])
    time.sleep(delay)

def text(t, delay=0.8):
    # Escape special characters for adb input text
    # In adb shell, spaces must be %s, exclamation and special chars handled carefully
    for ch in t:
        if ch == ' ':
            run(["shell", "input", "text", "%s"])
        elif ch in ['!', '@', '#', '$', '%', '&', '*', '(', ')']:
            run(["shell", "input", "text", f"\\{ch}"])
        else:
            run(["shell", "input", "text", ch])
        time.sleep(0.05)
    time.sleep(delay)

def capture(name):
    data = run(["exec-out", "screencap", "-p"])
    path = os.path.join(OUT_DIR, name)
    with open(path, "wb") as f:
        f.write(data)
    print(f"✓ Saved {name} ({len(data)} bytes)")
    return path

print("--- STARTING E2E AUTHENTICATED WALKTHROUGH ---")

# Step 1: Clean restart of app
print("1. Restarting app cleanly...")
run(["shell", "pm", "clear", "com.solaceai.app"])
time.sleep(1.0)
run(["shell", "monkey", "-p", "com.solaceai.app", "-c", "android.intent.category.LAUNCHER", "1"])
time.sleep(4.0)

# Step 2: Sign In with verified credentials
print("2. Entering credentials on Login screen...")
tap(540, 1115) # Email box
text("aadil.khurshid95@gmail.com")

tap(540, 1345) # Password box
text("Password123!@#")

key(111) # Hide keyboard
time.sleep(0.8)

print("3. Tapping Sign In...")
tap(540, 1545) # Sign In button
time.sleep(4.5)

capture("08_authenticated_home.png")

# Step 3: Check mood check-in on Home
print("4. Selecting mood 'Peaceful'...")
tap(235, 780) # Peaceful mood button
time.sleep(1.0)
capture("09_home_mood_selected.png")

# Step 4: Companion Tab
print("5. Navigating to Companion Tab...")
tap(405, 2300)
time.sleep(2.5)
capture("10_companion_authenticated.png")

# Step 5: Send chat message in Companion
print("6. Sending message to AI Companion...")
tap(450, 2240) # Chat input field
time.sleep(1.0)
text("Hello Solace, I feel peaceful and relaxed today.")
key(111) # Hide keyboard
time.sleep(0.8)

# Tap send button (arrow icon on the right of input bar, ~ x=980, y=2240)
tap(980, 2240)
print("Waiting for streaming response from backend & Gemini...")
time.sleep(6.0)
capture("11_companion_streamed_reply.png")

# Step 6: Discover Tab
print("7. Navigating to Discover Tab...")
tap(675, 2300)
time.sleep(2.0)
capture("12_discover_tab.png")

# Tap 'Begin practice' on Box Breathing (~ y=850)
print("8. Opening Box Breathing exercise...")
tap(250, 850)
time.sleep(2.0)
capture("13_box_breathing_modal.png")

# Close breathing modal (tap close 'X' or back)
key(4) # Back key
time.sleep(1.5)

# Step 7: Profile Tab
print("9. Navigating to Profile Tab...")
tap(945, 2300)
time.sleep(2.0)
capture("14_authenticated_profile.png")

print("--- COMPLETED E2E AUTHENTICATED WALKTHROUGH ---")
