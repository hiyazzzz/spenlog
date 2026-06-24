@echo off
cd /d C:\Users\curio\Desktop\spenlog
del .git\index.lock 2>nul
git add -A
git commit -m "fix: assets guide dismiss persistence + mobile onboarding improvements"
git push
pause
