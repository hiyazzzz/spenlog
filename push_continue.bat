@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
echo === 충돌 해결된 파일 스테이징 ===
git add "apps/web/src/app/(dashboard)/layout.tsx"
git add apps/web/src/components/ui/TabShell.tsx
echo === rebase 계속 ===
git rebase --continue
echo === push ===
git push origin HEAD:main
echo === 완료 ===
pause
