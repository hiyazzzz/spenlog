@echo off
cd /d C:\Users\curio\Desktop\spenlog
echo Killing git processes...
taskkill /f /im git.exe 2>nul
taskkill /f /im ssh.exe 2>nul
timeout /t 2 /nobreak >nul
echo Removing lock files...
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
del /f .git\objects\maintenance.lock 2>nul
del /f .git\refs\heads\main.lock 2>nul
del /f .git\refs\remotes\origin\main.lock 2>nul
echo Adding files...
git add -A
echo Committing...
git commit -m "feat: payment dropdown + 기타 + category filter fix + save toast + web edit dropdowns"
echo Pushing...
git push
pause
