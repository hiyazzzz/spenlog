@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
echo === 임시 변경사항 stash ===
git stash
echo === remote pull rebase ===
git pull --rebase origin main
echo === push ===
git push
echo === stash 복원 ===
git stash pop
echo === 완료 ===
pause
