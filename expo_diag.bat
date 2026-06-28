@echo off
echo Starting Expo diagnostic...
cd /d C:\Users\curio\Desktop\spenlog\apps\mobile
echo Current directory: %CD%
echo.
echo Checking pnpm...
pnpm --version
echo.
echo Starting Expo (Expo Go mode)...
pnpm expo start --clear --go > C:\Users\curio\Desktop\spenlog\expo_log.txt 2>&1
echo.
echo Expo exited with code %ERRORLEVEL%. See expo_log.txt
pause
