import subprocess
import os
import time

ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
OUT_DIR = os.path.abspath("screenshots")

def run(args):
    return subprocess.check_output([ADB] + args)

def tap(x, y):
    print(f"Tapping ({x}, {y})")
    run(["shell", "input", "tap", str(x), str(y)])
    time.sleep(1.2)

def capture(name):
    data = run(["exec-out", "screencap", "-p"])
    path = os.path.join(OUT_DIR, name)
    with open(path, "wb") as f:
        f.write(data)
    print(f"✓ Saved {name} ({len(data)} bytes)")

def key(k):
    run(["shell", "input", "keyevent", str(k)])
    time.sleep(0.4)

def text(t):
    run(["shell", "input", "text", t.replace(" ", "%s")])
    time.sleep(0.4)

# 1. Reset and open Login
print("Opening clean login...")
run(["shell", "pm", "clear", "com.solaceai.app"])
time.sleep(0.8)
run(["shell", "monkey", "-p", "com.solaceai.app", "-c", "android.intent.category.LAUNCHER", "1"])
time.sleep(3.5)
capture("05_login_clean.png")

# 2. Tap 'Create account' at bottom (x=700, y=2220)
print("Navigating to Signup screen...")
tap(700, 2220)
time.sleep(1.5)
capture("06_signup_clean.png")

# 3. Tap 'Sign in' link at bottom of signup screen (x=700, y=2300 or y=2250)
print("Returning to Login screen...")
tap(700, 2250)
time.sleep(1.5)

# 4. Fill in email on login screen
print("Entering credentials...")
tap(540, 1115) # Email box
text("aadil.khurshid95@gmail.com")

tap(540, 1345) # Password box
# Supabase user password
# If user set password, let's type it or test login
text("Password123!")

key(111) # Hide keyboard
time.sleep(0.5)

# 5. Tap Sign In button
print("Tapping Sign In...")
tap(540, 1545)
time.sleep(3.5)
capture("07_after_login_clean.png")

