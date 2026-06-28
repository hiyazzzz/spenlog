@echo off
cd /d C:\Users\curio\Desktop\spenlog
echo [1/4] index.lock 삭제 중...
del /f .git\index.lock 2>nul
echo [2/4] 변경 파일 스테이징...
git add apps\web\src\components\assets\AssetsClient.tsx
git add apps\mobile\app\(tabs)\assets.tsx
git add apps\mobile\app\(tabs)\history.tsx
echo [3/4] 커밋 중...
git commit -m "fix: 루틴 정렬 모바일 / 자산 단일편집 상태+레이블+포맷 / 카드 지출 배지"
echo [4/4] 푸시 중...
git push
echo.
echo === 완료! Vercel 배포 후 Expo Go 재실행해서 확인하세요 ===
pause
