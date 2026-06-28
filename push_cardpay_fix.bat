@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/mobile/app/(tabs)/assets.tsx
git commit -m "fix(mobile): card pay - use selected month not current month"
git push
pause
