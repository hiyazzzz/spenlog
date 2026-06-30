@echo off
chcp 65001 >nul
echo ==============================================
echo  Spenlog - 업데이트 + Expo Go 실행
echo ==============================================

:: 1. 리포 루트로 이동
echo.
echo [1/4] 프로젝트 폴더로 이동...
cd /d C:\Users\curio\Desktop\spenlog
if errorlevel 1 (
    echo [오류] 폴더 이동 실패: C:\Users\curio\Desktop\spenlog
    pause
    exit /b 1
)

:: 2. git pull
echo.
echo [2/4] 최신 코드 받기 (git pull origin main)...
git pull origin main
if errorlevel 1 (
    echo [오류] git pull 실패. 네트워크 연결 및 충돌 여부를 확인하세요.
    pause
    exit /b 1
)

:: 3. pnpm install (datetimepicker 등 새 패키지 포함)
echo.
echo [3/4] 패키지 설치 (pnpm install)...
call pnpm install
if errorlevel 1 (
    echo [오류] pnpm install 실패.
    pause
    exit /b 1
)

:: 4. 기존 Metro 서버 종료 후 Expo Go 모드 시작
echo.
echo [4/4] 기존 node 프로세스 종료 후 Expo Go 모드로 시작...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

cd /d C:\Users\curio\Desktop\spenlog\apps\mobile
call pnpm expo start --go --clear
pause
