@echo off
cd /d C:\Users\curio\Desktop\spenlog
del .git\index.lock 2>nul
git add -A
git commit -m "fix: remove flash on assets guide by inverting dismissed initial state"
git push
pause
