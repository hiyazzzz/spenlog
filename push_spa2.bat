@echo off
cd /d C:\Users\curio\Desktop\spenlog

echo === 모든 git lock 제거 ===
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\MERGE_HEAD 2>nul
del /f .git\CHERRY_PICK_HEAD 2>nul

echo === 스테이징 초기화 ===
git reset HEAD

echo === remote 변경사항 가져오기 ===
git pull --rebase origin main

echo === SPA 전환 파일만 스테이징 ===
git add apps/web/src/app/api/home-data/route.ts
git add apps/web/src/app/api/report-data/route.ts
git add apps/web/src/app/api/settings-data/route.ts
git add apps/web/src/components/dashboard/HomeClient.tsx
git add apps/web/src/components/dashboard/HomeDataLoader.tsx
git add apps/web/src/components/report/ReportDataLoader.tsx
git add apps/web/src/components/settings/SettingsDataLoader.tsx
git add apps/web/src/components/ui/TabShell.tsx
git add "apps/web/src/app/(dashboard)/layout.tsx"
git add "apps/web/src/app/(dashboard)/page.tsx"
git add "apps/web/src/app/(dashboard)/report/page.tsx"
git add "apps/web/src/app/(dashboard)/settings/page.tsx"
git add apps/web/src/components/ui/Prefetcher.tsx

echo === 커밋 내용 ===
git status --short

git commit -m "feat: SPA 전환 홈/리포트/설정 탭 (TabShell + DataLoader)"
git push

echo === 완료 ===
pause
