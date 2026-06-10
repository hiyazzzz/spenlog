@echo off
cd /d "C:\naver-economy-blog\output\components\spenlog"
echo [START] >> push_output.txt 2>&1
git stash >> push_output.txt 2>&1
git rebase origin/main >> push_output.txt 2>&1
git stash pop >> push_output.txt 2>&1
git push https://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@github.com/hiyazzzz/spenlog.git HEAD:main >> push_output.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> push_output.txt
