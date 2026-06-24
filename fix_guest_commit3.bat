@echo off
chcp 65001 >nul
cd /d C:\Users\curio\Desktop\spenlog
set LOG=fix_guest_commit3_log.txt
del /f /q ".git\index.lock" 2>nul
echo ==== COMMIT GUEST-USERS FIX v3 (client EnsureUserRow) ====> %LOG%
git add "apps/web/src/app/(dashboard)/layout.tsx" >> %LOG% 2>&1
git add "apps/web/src/components/auth/EnsureUserRow.tsx" >> %LOG% 2>&1
git commit -m "fix(web): ensure guest users row client-side (EnsureUserRow) to avoid RSC cache" >> %LOG% 2>&1
git push origin main >> %LOG% 2>&1
echo [PUSH EXIT %ERRORLEVEL%]>> %LOG%
git log --oneline -1 >> %LOG% 2>&1
echo ==== DONE ====>> %LOG%
