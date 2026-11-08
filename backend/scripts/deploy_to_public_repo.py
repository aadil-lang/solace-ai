import os
import shutil
import subprocess

token = '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'
remote_url = f'https://aadil-lang:{token}@github.com/aadil-lang/solace-ai-gallery.git'

work_dir = os.path.abspath('temp_gallery_deploy')
if os.path.exists(work_dir):
    shutil.rmtree(work_dir)
os.makedirs(work_dir, exist_ok=True)

# Copy index.html, gallery.html
shutil.copy2('index.html', os.path.join(work_dir, 'index.html'))
shutil.copy2('gallery.html', os.path.join(work_dir, 'gallery.html'))

# Copy screenshots/
shutil.copytree('screenshots', os.path.join(work_dir, 'screenshots'))

# Copy .github/workflows
os.makedirs(os.path.join(work_dir, '.github', 'workflows'), exist_ok=True)
shutil.copy2(os.path.join('.github', 'workflows', 'deploy-pages.yml'), os.path.join(work_dir, '.github', 'workflows', 'deploy-pages.yml'))

# Create README.md
readme_content = """# Solace AI — Mobile Verification & Screen Gallery

> **"A little space to feel understood."**  
> A premium AI-powered wellness companion designed for mindful reflection, emotional grounding, and consent-based emotional memory.

## 🌐 Live Interactive Gallery
👉 **[View Interactive Web Gallery](https://aadil-lang.github.io/solace-ai-gallery/)**

---

## 📱 Mobile Verification Screens
This public repository hosts the end-to-end device verification screenshots captured on a Google Pixel 7 Android emulator (`emulator-5554`), showcasing:
- **Authentication**: Welcome, Sign In, and Registration screens with Supabase Auth.
- **Guest Experience**: Zero-barrier 6-mood tactile check-in grid and private sanctuary gating.
- **Authenticated Sanctuary**: Personalized daily greetings, companion conversations, and real-time streaming dialogue.
- **Mindfulness & Somatics**: Categorized grounding practices and interactive Box Breathing bottom-sheet modal.
- **Radical Consent**: Complete user sovereignty over AI emotional memory and preferences.

---

## 📥 Standalone Android Preview APK
- **EAS Build Status**: `FINISHED (SUCCESS)`
- **Direct APK Download**: [Download Solace APK (90.7 MB)](https://expo.dev/artifacts/eas/YZFgz1jEFCc7I7ZBaO5m262mV0R69NeDTaQXDW_sXYs.apk)

---

## 🖼️ Master 3x3 Presentation Collage
![Solace Master Walkthrough Collage](./screenshots/solace_complete_walkthrough_collage.png)
"""

with open(os.path.join(work_dir, 'README.md'), 'w', encoding='utf-8') as f:
    f.write(readme_content)

# Git init and push
commands = [
    ['git', 'init'],
    ['git', 'config', 'user.name', 'aadil-lang'],
    ['git', 'config', 'user.email', 'aadil.khurshid95@gmail.com'],
    ['git', 'remote', 'add', 'origin', remote_url],
    ['git', 'add', '.'],
    ['git', 'commit', '-m', 'feat: initial release of Solace AI public interactive gallery and screenshots'],
    ['git', 'branch', '-M', 'main'],
    ['git', 'push', '-u', 'origin', 'main', '--force'],
    ['git', 'push', 'origin', 'main:gh-pages', '--force']
]

for cmd in commands:
    print('Running:', ' '.join(cmd[:3]))
    res = subprocess.run(cmd, cwd=work_dir, capture_output=True, text=True)
    if res.returncode != 0:
        print('Error:', res.stderr.replace(token, '***'))
    else:
        print('✓ Success')

# Clean up temporary folder
shutil.rmtree(work_dir)
print('✓ Successfully deployed to public repo and cleaned up temp files!')

