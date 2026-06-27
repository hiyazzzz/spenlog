@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul

git add "apps/mobile/app/(tabs)/budget.tsx"
git add "push_final.bat"

git status --short
git commit -m "fix: budget AI tab - remove income>0 gate, show preset breakdown always"
git push
pause
