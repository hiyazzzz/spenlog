@echo off
del /f .git\index.lock 2>nul
git add apps/web/src/components/assets/AssetsClient.tsx
git commit -m "feat(web): card pay - custom number keypad (no iOS zoom)"
git push
pause
