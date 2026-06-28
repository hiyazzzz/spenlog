@echo off
cd /d C:\Users\curio\Desktop\spenlog

echo === git lock 제거 ===
del /f .git\index.lock 2>nul
del /f .git\refs\remotes\origin\main.lock 2>nul

echo === 스테이징 초기화 (코드 세션 임시 변경 제거) ===
git reset HEAD

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

echo === 커밋 내용 확인 ===
git status --short

echo === 커밋 & 푸시 ===
git commit -m "feat: SPA 전환 홈/리포트/설정 탭 (TabShell + DataLoader)"
git push

echo === 완료 ===
pause
