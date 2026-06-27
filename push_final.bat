@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul

git add "apps/mobile/app/(tabs)/assets.tsx"
git add "apps/mobile/app/(tabs)/budget.tsx"
git add "push_final.bat"

git status --short
git commit -m "fix: budget AI preset breakdown + fixed cost edit labels in assets.tsx"
git push
pause
