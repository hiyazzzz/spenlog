@echo off
cd /d "C:\naver-economy-blog\output\components\spenlog"
echo Removing lock files...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul
echo Staging file...
git config user.email "bot@spenlog.app"
git config user.name "Claude"
git add src/app/api/ai-input/route.ts
echo Committing...
git commit -m "fix: AI 파싱 amount 타입 버그 수정 + 프롬프트 개선"
echo Pushing...
git push https://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@github.com/hiyazzzz/spenlog.git HEAD:main
echo Done!
pause
