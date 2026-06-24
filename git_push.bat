@echo off
cd /d C:\Users\curio\Desktop\spenlog
if errorlevel 1 (
  echo ERROR: Cannot cd to project folder
  pause
  exit /b 1
)
git add -A
git status
echo.
set /p msg=Commit message: 
git commit -m "%msg%"
git push
echo.
echo Done! Check Vercel: https://vercel.com/dashboard
pause
