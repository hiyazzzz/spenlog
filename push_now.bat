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
git add apps/web/src/components/history/HistoryDataLoader.tsx apps/web/src/components/expense/AddExpenseForm.tsx
git commit -m "fix: history tab always refetches on nav, add form clears cache before push"
git push
pause
