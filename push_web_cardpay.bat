@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/web/src/components/assets/AssetsClient.tsx
git commit -m "feat(web): card pay modal - month selector chips + prev month default"
git push
pause
