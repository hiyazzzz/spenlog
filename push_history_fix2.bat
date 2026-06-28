@echo off
del /f .git\index.lock 2>nul
git add apps/web/src/components/history/HistoryClient.tsx
git commit -m "fix: move confirmModal to HistoryClient scope (was inside TransferEditRow)"
git push
pause
