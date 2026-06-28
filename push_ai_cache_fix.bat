@echo off
del /f .git\index.lock 2>nul
git add apps/web/src/components/expense/AiInputBox.tsx
git commit -m "fix(web): clear history cache after AI input save"
git push
pause
