@echo off
echo Removing git lock files...
if exist C:\Users\curio\Desktop\spenlog\.git\index.lock del /f C:\Users\curio\Desktop\spenlog\.git\index.lock
if exist C:\Users\curio\Desktop\spenlog\.git\refs\remotes\origin\main.lock del /f C:\Users\curio\Desktop\spenlog\.git\refs\remotes\origin\main.lock

cd /d C:\Users\curio\Desktop\spenlog

echo Resetting staged changes...
git reset HEAD

echo Adding AssetsClient fix...
git add apps/web/src/components/assets/AssetsClient.tsx

echo Committing...
git commit -m "fix: FixedRow 수정 버튼 - acc/fmt 잘못된 참조 제거 (Vercel 빌드 에러 수정)"

echo Pushing...
git push

echo Done! Vercel 배포 확인: https://vercel.com/dashboard
pause
