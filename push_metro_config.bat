@echo off
cd /d C:\Users\curio\Desktop\spenlog

echo Removing index lock...
if exist .git\index.lock del /f .git\index.lock

echo Staging metro.config.js...
git add apps/mobile/metro.config.js

echo Committing...
git commit -m "fix: add metro.config.js for pnpm monorepo symlink resolution"

echo Pushing...
git push origin main

echo Done!
pause
