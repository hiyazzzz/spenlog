@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/web/src/components/assets/AssetsClient.tsx
git add apps/mobile/app/(tabs)/assets.tsx
git commit -m "feat: card pay month - chip selector + guide text (web+mobile)"
git push
pause
