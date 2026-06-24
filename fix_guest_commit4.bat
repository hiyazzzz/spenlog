@echo off
chcp 65001 >nul
cd /d C:\Users\curio\Desktop\spenlog
set LOG=fix_guest_commit4_log.txt
del /f /q ".git\index.lock" 2>nul
echo ==== COMMIT GUEST-USERS FIX v4 (empty-string email) ====> %LOG%
git add "apps/web/src/app/(dashboard)/layout.tsx" >> %LOG% 2>&1
git add "apps/web/src/components/auth/EnsureUserRow.tsx" >> %LOG% 2>&1
git add "supabase_migration_guest_users.sql" >> %LOG% 2>&1
git commit -m "fix(web): guest email is empty string not null; use || + nullif for unique placeholder" >> %LOG% 2>&1
git push origin main >> %LOG% 2>&1
echo [PUSH EXIT %ERRORLEVEL%]>> %LOG%
git log --oneline -1 >> %LOG% 2>&1
echo ==== DONE ====>> %LOG%
