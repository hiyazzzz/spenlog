@echo off
cd /d "C:\naver-economy-blog\output\components\spenlog"

echo [1/4] Removing stale git lock files...
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\refs\heads\main.lock" del /f ".git\refs\heads\main.lock"

echo [2/4] Staging vercel.json...
git add vercel.json

echo [3/4] Committing...
git -c user.email="curious9733@gmail.com" -c user.name="이갱" commit -m "fix: remove invalid cron query params from vercel.json"

echo [4/4] Pushing to GitHub with PAT...
git push https://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@github.com/hiyazzzz/spenlog.git main

echo.
echo Done! Now resetting remote URL to original (no PAT)...
git remote set-url origin https://github.com/hiyazzzz/spenlog.git
echo Remote URL restored.
echo.
pause
