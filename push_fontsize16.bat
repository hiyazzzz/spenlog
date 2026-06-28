@echo off
del /f .git\index.lock 2>nul
git add apps/web/src/components/assets/AssetsClient.tsx
git commit -m "fix(web): card pay amount input font-size 16px (prevent iOS zoom)"
git push
pause
