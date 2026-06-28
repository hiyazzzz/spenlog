@echo off
cd /d "%~dp0"
echo Killing any stuck git processes...
taskkill /f /im git.exe 2>nul
timeout /t 2 /nobreak >nul
echo Removing git lock...
del /f ".git\index.lock" 2>nul
echo Adding file...
git add "apps/mobile/app/(tabs)/assets.tsx"
git status --short
git commit -m "fix: presetAmounts BASE_RATIO normalization"
git push
echo.
echo === Done! ===
pause
