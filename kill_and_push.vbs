Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")
sDir = "C:\naver-economy-blog\output\components\spenlog"
sPAT = "https://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@github.com/hiyazzzz/spenlog.git"

' Kill any git.exe processes
oShell.Run "taskkill /f /im git.exe", 0, True

WScript.Sleep 1000

' Force delete lock files
On Error Resume Next
oFS.DeleteFile sDir & "\.git\index.lock", True
oFS.DeleteFile sDir & "\.git\HEAD.lock", True
oFS.DeleteFile sDir & "\.git\refs\heads\main.lock", True
On Error GoTo 0

WScript.Sleep 500

' Run git pull rebase then push - write output to file
oShell.CurrentDirectory = sDir
oShell.Run "cmd /c cd /d " & Chr(34) & sDir & Chr(34) & " && git pull " & sPAT & " main --rebase && git push " & sPAT & " HEAD:main", 1, True

MsgBox "Done! Check GitHub to verify push.", 0, "Complete"
