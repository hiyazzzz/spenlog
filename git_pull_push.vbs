Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

sDir = "C:\naver-economy-blog\output\components\spenlog"
sPAT = "https://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@github.com/hiyazzzz/spenlog.git"

' Delete lock files
On Error Resume Next
oFS.DeleteFile sDir & "\.git\index.lock", True
oFS.DeleteFile sDir & "\.git\HEAD.lock", True
oFS.DeleteFile sDir & "\.git\refs\heads\main.lock", True
On Error GoTo 0

' Pull then push
oShell.CurrentDirectory = sDir
sCmd = "cmd /c git pull " & sPAT & " main --rebase && git push " & sPAT & " HEAD:main"
oShell.Run sCmd & " > " & sDir & "\git_result2.txt 2>&1", 1, True

' Show result
Set oFile = oFS.OpenTextFile(sDir & "\git_result2.txt", 1)
MsgBox oFile.ReadAll, 0, "Git Pull+Push Result"
oFile.Close
