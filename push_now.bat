@echo off
cd /d C:/Users/curio/Desktop/spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add apps/web/src/components/history/HistoryClient.tsx
git add apps/web/src/app/(dashboard)/history/page.tsx
git add apps/web/src/components/history/HistoryDataLoader.tsx
git add apps/web/src/app/api/history-data/route.ts
git add apps/web/src/components/assets/AssetsDataLoader.tsx
git add apps/web/src/app/api/assets-data/route.ts
git add apps/web/src/app/(dashboard)/assets/page.tsx
git add apps/web/src/app/(dashboard)/layout.tsx
git add apps/web/src/components/ui/Prefetcher.tsx
git add apps/web/src/app/(dashboard)/add/loading.tsx
git add apps/web/src/app/(dashboard)/assets/loading.tsx
git add apps/web/src/app/(dashboard)/budget/loading.tsx
git add apps/web/src/app/(dashboard)/category/loading.tsx
git add apps/web/src/app/(dashboard)/fixed/loading.tsx
git add apps/web/src/app/(dashboard)/history/loading.tsx
git add apps/web/src/app/(dashboard)/report/loading.tsx
git add apps/web/src/app/(dashboard)/settings/loading.tsx
git add apps/web/src/components/budget/BudgetForm.tsx
git add apps/web/src/components/dashboard/HomeCategoryGrid.tsx
git add apps/web/src/components/fixed/FixedCostList.tsx
git add apps/web/src/components/assets/AssetsClient.tsx
git commit -m "feat: transfer edit - account dropdowns + auto balance update"
git push
pause
