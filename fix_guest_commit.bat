@echo off
chcp 65001 >nul
cd /d C:\Users\curio\Desktop\spenlog
set LOG=fix_guest_commit_log.txt
del /f /q ".git\index.lock" 2>nul
echo ==== COMMIT GUEST-USERS FIX ====> %LOG%
git add "apps/web/src/app/(dashboard)/layout.tsx" >> %LOG% 2>&1
git add "supabase_migration_guest_users.sql" >> %LOG% 2>&1
git commit -m "fix(web): ensure public.users row for guests in dashboard layout (fixes expenses 409 FK 23503)" >> %LOG% 2>&1
git push origin main >> %LOG% 2>&1
echo [PUSH EXIT %ERRORLEVEL%]>> %LOG%
git log --oneline -2 >> %LOG% 2>&1
echo ==== DONE ====>> %LOG%
