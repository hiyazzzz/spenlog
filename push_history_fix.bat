@echo off
del /f .git\index.lock 2>nul
git add apps/web/src/components/history/HistoryClient.tsx
git commit -m "fix: restore truncated CalendarView in HistoryClient (virtiofs corruption)"
git push
pause
