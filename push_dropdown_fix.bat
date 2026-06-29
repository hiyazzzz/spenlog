@echo off
cd /d C:\Users\curio\Desktop\spenlog
taskkill /f /im git.exe 2>nul
del /f .git\index.lock 2>nul
git add -A
git commit -m "feat: grouped dropdown picker (카드/계좌 헤더, 이름순) for payment methods"
git push
echo.
echo === Push complete ===
pause
