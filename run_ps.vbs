Dim oShell
Set oShell = CreateObject("WScript.Shell")
oShell.Run "powershell.exe -ExecutionPolicy Bypass -File ""C:\naver-economy-blog\output\components\spenlog\git_push.ps1""", 1, True
MsgBox "Done! Check push_output.txt"
