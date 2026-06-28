@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
echo === remote pull rebase ===
git pull --rebase origin main
echo === push ===
git push
echo === 완료 ===
pause
