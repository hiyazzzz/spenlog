@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/mobile/app/(tabs)/_layout.tsx
git add apps/mobile/lib/api/budget.ts
git add apps/mobile/lib/api/assets.ts
git add apps/mobile/app/(tabs)/assets.tsx
git commit -m "feat(mobile): tab bar UI + budget NULL fix + card pay month selector"
git push
pause
