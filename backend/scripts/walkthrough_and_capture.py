import subprocess
import os
import time
from PIL import Image, ImageDraw, ImageFont

ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
OUT_DIR = os.path.abspath("screenshots")
os.makedirs(OUT_DIR, exist_ok=True)

def run_adb(args):
    cmd = [ADB] + args
    return subprocess.check_output(cmd)

def tap(x, y):
    print(f"Tapping ({x}, {y})...")
    run_adb(["shell", "input", "tap", str(x), str(y)])
    time.sleep(1.2)

def capture(filename, label=""):
    path = os.path.join(OUT_DIR, filename)
    data = run_adb(["exec-out", "screencap", "-p"])
    with open(path, "wb") as f:
        f.write(data)
    print(f"✓ Captured {filename} ({len(data)} bytes) - {label}")
    return path

def type_text(text):
    print(f"Typing: {text}")
    # Replace spaces with %s for adb input
    safe_text = text.replace(" ", "%s").replace("&", "\&")
    run_adb(["shell", "input", "text", safe_text])
    time.sleep(0.5)

def press_key(keycode):
    run_adb(["shell", "input", "keyevent", str(keycode)])
    time.sleep(0.5)

def main():
    print("--- STARTING AUTOMATED APP WALKTHROUGH & SCREENSHOT CAPTURE ---")

    # Step 1: Companion tab (Guest)
    print("\n[1/7] Navigating to Companion Tab (Guest Sanctuary Gate)...")
    tap(405, 2300)
    capture("02_companion_guest.png", "Companion Tab - Guest Sanctuary Gate")

    # Step 2: Discover tab
    print("\n[2/7] Navigating to Discover Tab...")
    tap(675, 2300)
    capture("03_discover.png", "Discover Tab - Grounding & Mindfulness Exercises")

    # Step 3: Profile tab (Guest)
    print("\n[3/7] Navigating to Profile Tab (Guest)...")
    tap(945, 2300)
    capture("04_profile_guest.png", "Profile Tab - Guest Mode & Telemetry")

    # Step 4: Reset app data to capture clean Welcome & Login Screen
    print("\n[4/7] Resetting app data to capture Login & Signup screens...")
    run_adb(["shell", "pm", "clear", "com.solaceai.app"])
    time.sleep(1.0)
    run_adb(["shell", "monkey", "-p", "com.solaceai.app", "-c", "android.intent.category.LAUNCHER", "1"])
    time.sleep(3.5)
    capture("05_login.png", "Login Screen")

    # Step 5: Navigate to Signup screen
    print("\n[5/7] Navigating to Signup Screen...")
    # On Login screen, tap "Sign up" at bottom (approx x=710, y=1980 or y=2000)
    # Let's tap around x=700, y=1980
    tap(720, 1980)
    time.sleep(1.0)
    capture("06_signup.png", "Sign Up Screen")

    # Tap "Sign in" at bottom to return to login
    print("\n[6/7] Returning to Login Screen...")
    tap(680, 2060)
    time.sleep(1.5)

    # Step 6: Log in as confirmed user
    print("\n[7/7] Logging in as aadil.khurshid95@gmail.com...")
    # Tap email input (approx x=540, y=980)
    tap(540, 980)
    type_text("aadil.khurshid95@gmail.com")
    
    # Tap password input (approx x=540, y=1180)
    tap(540, 1180)
    type_text("Password123!@#Test")
    
    # Hide keyboard
    press_key(111) # KEYCODE_ESCAPE
    time.sleep(0.5)

    # Tap "Sign In" button (approx x=540, y=1340)
    tap(540, 1340)
    time.sleep(3.5)

    capture("07_after_login.png", "After Login Screen (Onboarding or Home)")

    print("\n--- SCREENSHOT CAPTURE WALKTHROUGH COMPLETED ---")

if __name__ == "__main__":
    main()

