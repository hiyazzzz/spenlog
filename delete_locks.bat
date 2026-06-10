@echo off
echo Deleting git lock files...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\MERGE_HEAD.lock" 2>nul
del /f /q ".git\COMMIT_EDITMSG.lock" 2>nul
for %%f in (.git\refs\heads\*.lock) do del /f /q "%%f" 2>nul
for %%f in (.git\*.lock.bak.disabled) do del /f /q "%%f" 2>nul
echo Done! All lock files removed.
pause
