@echo off
echo [Spenlog] expo-auth-session, expo-web-browser 설치 중...
cd /d "%~dp0apps\mobile"
call npx expo install expo-auth-session expo-web-browser
echo.
echo [Spenlog] Expo 재시작 (캐시 초기화)...
call npx expo start --clear
pause
