import subprocess
import os
import time

ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
OUT_DIR = os.path.abspath("screenshots")

def run(args):
    return subprocess.check_output([ADB] + args)

def tap(x, y, delay=1.5):
    print(f"Tapping ({x}, {y})")
    run(["shell", "input", "tap", str(x), str(y)])
    time.sleep(delay)

def key(k, delay=0.5):
    run(["shell", "input", "keyevent", str(k)])
    time.sleep(delay)

def capture(name):
    data = run(["exec-out", "screencap", "-p"])
    path = os.path.join(OUT_DIR, name)
    with open(path, "wb") as f:
        f.write(data)
    print(f"✓ Saved {name} ({len(data)} bytes)")
    return path

# 1. Hide any keyboard
key(111)
time.sleep(0.5)

# 2. Go to Companion Tab (x=405, y=2300)
print("1. Go to Companion Tab...")
tap(405, 2300)
time.sleep(1.0)
key(111) # ensure keyboard is hidden
time.sleep(0.5)

# Tap suggested starter: "Can you guide me through a gentle grounding pause?" (~ y=1160, x=500)
print("2. Tapping suggested prompt...")
tap(500, 1160)
print("Waiting for AI response...")
time.sleep(6.5)
capture("11_companion_streamed_reply.png")

# 3. Go to Discover Tab (x=675, y=2300)
print("3. Navigating to Discover Tab...")
tap(675, 2300)
time.sleep(1.5)
capture("12_discover_tab.png")

# 4. In Discover Tab, tap "Begin practice ->" on Box Breathing (~ x=250, y=1000)
# Let's check where Box Breathing card button is on 03_discover.png
# On 03_discover.png, 'Begin practice ->' is at y=1000, x=220
print("4. Tapping Box Breathing 'Begin practice'...")
tap(220, 1000)
time.sleep(2.0)
capture("13_box_breathing_modal.png")

# 5. Tap Back or Close
key(4)
time.sleep(1.0)

# 6. Go to Profile Tab (x=945, y=2300)
print("5. Navigating to Profile Tab...")
tap(945, 2300)
time.sleep(1.5)
capture("14_authenticated_profile.png")

print("Finished capturing clean screens!")

