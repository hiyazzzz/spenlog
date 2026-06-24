@echo off
cd /d C:\Users\curio\Desktop\spenlog

echo Removing index lock...
if exist .git\index.lock del /f .git\index.lock

echo Staging changes...
git add apps/mobile/app/(tabs)/fixed-costs.tsx
git add apps/mobile/lib/api/fixed-costs.ts
git add apps/mobile/lib/api/routine.ts
git add apps/web/src/components/assets/AssetsClient.tsx
git add apps/web/src/components/assets/RoutineBanner.tsx
git add apps/web/src/lib/routine.ts
git add packages/types/src/index.ts

echo Committing...
git commit -m "feat: fixed cost edit form linked account/card + routine payment auto-deduction"

echo Pushing...
git push origin main

echo Done!
pause
