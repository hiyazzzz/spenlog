@echo off
ipconfig /release >nul 2>&1
ipconfig /renew >nul 2>&1
ipconfig | findstr "IPv4" > C:\Users\curio\Desktop\spenlog\ip_new.txt
type C:\Users\curio\Desktop\spenlog\ip_new.txt
pause
