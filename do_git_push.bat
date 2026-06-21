@echo off
cd /d C:\Users\curio\Desktop\spenlog
del .git\index.lock 2>nul
del .git\HEAD.lock 2>nul

REM === android/ios 폴더 git 추적 해제 (파일은 디스크에 유지) ===
git rm -r --cached apps/mobile/android 2>nul
git rm -r --cached apps/mobile/ios 2>nul

REM === 변경 파일 추가 ===
git add ".npmrc"
git add "eas.json"
git add "apps/mobile/.gitignore"
git add "apps/mobile/app/(tabs)/_layout.tsx"
git add "apps/mobile/app/(tabs)/index.tsx"
git add "apps/mobile/app/(tabs)/assets.tsx"
git add "apps/mobile/app/(tabs)/history.tsx"
git add "apps/mobile/app/(tabs)/report.tsx"
git add "apps/mobile/app/(tabs)/settings.tsx"
git add "apps/mobile/app/onboarding.tsx"
git add "apps/mobile/app/category.tsx"
git add "apps/mobile/components/HomeEditModal.tsx"
git add "apps/mobile/components/CenterModal.tsx"
git add "apps/mobile/constants/theme.ts"
git add "apps/web/src/components/onboarding/OnboardingForm.tsx"
git status
git commit -m "fix: remove android/ios from git (CNG mode), add shamefully-hoist"
git push origin main
echo.
echo === Done. EAS will now run expo prebuild automatically ===
pause
