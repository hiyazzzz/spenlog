Dim oShell, oFS, sDir, sPAT, sResult
Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

sDir = "C:\naver-economy-blog\output\components\spenlog"
sPAT = "https://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@github.com/hiyazzzz/spenlog.git"

' Kill git
oShell.Run "taskkill /f /im git.exe", 0, True
WScript.Sleep 1000

' Delete all lock files
Dim lockFiles
lockFiles = Array(".git\index.lock", ".git\HEAD.lock", ".git\index2.lock", ".git\index3.lock", ".git\index_new.lock")
Dim lf
For Each lf In lockFiles
  If oFS.FileExists(sDir & "\" & lf) Then
    On Error Resume Next
    oFS.DeleteFile sDir & "\" & lf, True
    On Error GoTo 0
  End If
Next

' Run: stash, rebase, pop, push
Dim cmd
cmd = "cmd /c cd /d """ & sDir & """ && " & _
      "git stash && " & _
      "git rebase origin/main && " & _
      "git stash pop && " & _
      "git push " & sPAT & " HEAD:main > """ & sDir & "\push_result.txt"" 2>&1"

oShell.Run cmd, 1, True

' Read result
If oFS.FileExists(sDir & "\push_result.txt") Then
  Dim oFile
  Set oFile = oFS.OpenTextFile(sDir & "\push_result.txt", 1)
  sResult = oFile.ReadAll
  oFile.Close
  MsgBox "Result:" & Chr(10) & sResult
Else
  MsgBox "push_result.txt not found"
End If
