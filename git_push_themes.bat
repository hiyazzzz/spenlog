@echo off
chcp 65001 > nul
cd /d "C:\Users\curio\Desktop\spenlog"

echo ====================================================
echo  Spenlog Git Push - themes fix
echo ====================================================
echo.

echo [1/6] Lock files cleanup...
if exist ".git\index.lock" del /f /q ".git\index.lock" && echo     index.lock deleted
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock" && echo     HEAD.lock deleted
if exist ".git\refs\heads\main.lock" del /f /q ".git\refs\heads\main.lock" && echo     main.lock deleted

echo.
echo [2/6] Git config...
git config user.email "curious9733@gmail.com"
git config user.name "spenlog"

echo.
echo [3/6] Stage all changes (git add -A)...
git add -A
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: git add failed
    pause
    exit /b 1
)
echo     Done.

echo.
echo [4/6] Git status check...
git status --short

echo.
echo [5/6] Commit...
git commit -m "fix(web): THEMES 객체에 누락된 5개 테마 추가 + apps/web 복구"
if %ERRORLEVEL% NEQ 0 (
    echo NOTE: Nothing to commit or commit failed
)

echo.
echo [6/6] Push to GitHub...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Push failed
    pause
    exit /b 1
)

echo.
echo ====================================================
echo  DONE! Vercel will auto-rebuild.
echo ====================================================
pause
