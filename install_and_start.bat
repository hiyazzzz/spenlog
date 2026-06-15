@echo off
echo [Spenlog] pnpm 의존성 설치 확인 중...
cd /d "%~dp0"
call pnpm install
echo.
echo [Spenlog] expo-auth-session, expo-web-browser 설치 중...
cd /d "%~dp0apps\mobile"
call pnpm expo install expo-auth-session expo-web-browser
echo.
echo [Spenlog] Expo 재시작 (캐시 초기화)...
call pnpm expo start --clear
pause
