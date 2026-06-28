@echo off
echo Testing pnpm... > C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
pnpm --version >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
echo pnpm check done. >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
cd /d C:\Users\curio\Desktop\spenlog\apps\mobile >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
echo CD done: %CD% >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
pnpm expo --version >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
echo Expo check done >> C:\Users\curio\Desktop\spenlog\pnpm_test.txt 2>&1
pause
