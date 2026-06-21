@echo off
chcp 65001 >nul
echo ========================================
echo  Spenlog EAS Development Build (Android)
echo ========================================
cd /d C:\Users\curio\Desktop\spenlog\apps\mobile

echo.
echo [1/4] Installing EAS CLI...
call npm install -g eas-cli
echo.

echo [2/4] Expo login (browser will open)...
call eas login
echo.

echo [3/4] Configure EAS project...
call eas build:configure
echo.

echo [4/4] Starting Android development build...
echo (Cloud build takes 10-20 minutes)
call eas build --profile development --platform android
echo.

echo ========================================
echo  Done! Check the link above for build status.
echo ========================================
pause
