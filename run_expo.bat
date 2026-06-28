@echo off
echo Killing all node processes...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo Installing packages...
cd /d C:\Users\curio\Desktop\spenlog
call pnpm install

echo Starting Expo (Expo Go mode)...
cd /d C:\Users\curio\Desktop\spenlog\apps\mobile
call pnpm expo start --clear --go
pause
