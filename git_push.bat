@echo off
cd /d C:\Users\curio\Desktop\spenlog
echo === Spenlog git push ===
git add -A
git status
echo.
set /p msg="커밋 메시지 입력: "
git commit -m "%msg%"
git push
echo.
echo === 완료! Vercel 배포 확인: https://vercel.com/dashboard ===
pause
