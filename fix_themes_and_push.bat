@echo off
cd /d "C:\Users\curio\Desktop\spenlog"

echo [1/5] Writing themes.ts via Python...
python write_themes.py
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python failed
    pause
    exit /b 1
)

echo [2/5] Cleaning lock files...
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
if exist ".git\refs\heads\main.lock" del /f /q ".git\refs\heads\main.lock"

echo [3/5] Git add + status...
git config user.email "curious9733@gmail.com"
git config user.name "spenlog"
git add apps/web/src/lib/themes.ts
git status --short apps/web/src/lib/themes.ts

echo [4/5] Commit...
git commit -m "fix(web): add missing 5 themes to THEMES object"
if %ERRORLEVEL% NEQ 0 (
    echo NOTE: nothing to commit
)

echo [5/5] Push...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: push failed
    pause
    exit /b 1
)

echo.
echo DONE!
pause
