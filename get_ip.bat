@echo off
ipconfig | findstr /i "IPv4" > "%~dp0my_ip.txt"
echo 완료! my_ip.txt 파일에 저장됨
pause
