@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul

git add "apps/mobile/app/(tabs)/assets.tsx"

git status --short
git commit -m "fix: presetAmounts BASE_RATIO normalization for custom categories (e.g. 친목비)"
git push
pause
