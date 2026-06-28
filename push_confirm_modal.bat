@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/web/src/components/history/HistoryClient.tsx
git commit -m "feat(web): card pay confirm - custom bottom sheet modal"
git push
pause
