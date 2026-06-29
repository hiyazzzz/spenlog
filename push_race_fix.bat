@echo off
cd /d C:\Users\curio\Desktop\spenlog
taskkill /f /im git.exe 2>nul
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: history tab race condition - generation counter + Zustand store subscription"
git push
echo.
echo === Push complete ===
pause
