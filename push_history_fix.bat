@echo off
cd /d C:\Users\curio\Desktop\spenlog
taskkill /f /im git.exe 2>nul
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: history tab instant refresh after save (prefetch on mobile, force-refresh flag on web)"
git push
pause
