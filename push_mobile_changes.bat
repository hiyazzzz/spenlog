@echo off
cd /d C:\Users\curio\Desktop\spenlog
del /f .git\refs\remotes\origin\main.lock 2>nul
del /f .git\index.lock 2>nul
git add "apps/mobile/app/(tabs)/_layout.tsx"
git add "apps/mobile/lib/api/budget.ts"
git add "apps/mobile/lib/api/assets.ts"
git add "apps/mobile/app/(tabs)/assets.tsx"
git commit -m "feat(mobile): 탭바 텍스트+상단바 UI, 예산 달성률 NULL 타입 수정, 카드 납부 월 선택 기능"
git push
pause
