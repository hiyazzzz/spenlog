@echo off
cd /d C:\Users\curio\Desktop\spenlog
del .git\index.lock 2>nul
git add apps/web/src/components/assets/RoutineBanner.tsx apps/mobile/app/add.tsx apps/mobile/lib/api/assets.ts apps/mobile/lib/api/expenses.ts
git commit -m "fix: RoutineBanner 잘림 수정 + 이체탭 추가 + deleteExpense 이체 역복구"
git push
pause
