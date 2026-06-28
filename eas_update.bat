@echo off
cd /d "%~dp0\apps\mobile"
echo === EAS Update: preview branch ===
call npx eas-cli update --branch preview --message "update" --non-interactive
echo.
echo === Done! ===
echo exp://u.expo.dev/a99c1ae4-b199-4f8d-8762-4b30f52c4e94?channel-name=preview
pause
