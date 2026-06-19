@echo off
chcp 65001 > nul
cd /d "C:\Users\curio\Desktop\spenlog"

echo [1/5] index.lock 삭제 중...
if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
    echo     삭제 완료
) else (
    echo     lock 파일 없음
)

echo [2/5] git config 설정...
git config user.email "curious9733@gmail.com"
git config user.name "spenlog"

echo [3/5] git add -A...
git add -A

echo [4/5] git commit...
git commit -m "feat: 카테고리 드래그 리오더 + 한줄기록 확인팝업 + 고정비 폼 연결계좌 + 버그수정 다수"

echo [5/5] git push origin main...
git push origin main

echo.
echo =============================
echo 완료! 아무 키나 누르면 닫힙니다.
echo =============================
pause
