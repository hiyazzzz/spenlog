@echo off
cd /d C:\Users\curio\Desktop\spenlog
taskkill /f /im git.exe 2>nul
taskkill /f /im ssh.exe 2>nul
timeout /t 2 /nobreak >nul
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
del /f .git\objects\maintenance.lock 2>nul
del /f .git\refs\heads\main.lock 2>nul
del /f .git\refs\remotes\origin\main.lock 2>nul
git add -A
git commit -m "fix: card names in paymentMethods, card pay default to current month"
git push
pause
