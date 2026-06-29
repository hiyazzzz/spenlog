@echo off
cd /d C:\Users\curio\Desktop\spenlog
taskkill /f /im git.exe 2>nul
del /f .git\index.lock 2>nul
del /f .git\index 2>nul
git reset HEAD 2>nul
git add -A
git commit -m "fix: apply grouped dropdown to history EditRow, remove default pay methods"
git push
echo.
echo === Done ===
pause
