Dim oShell, oFS, sDir
Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

sDir = "C:\naver-economy-blog\output\components\spenlog"

' Kill git
oShell.Run "taskkill /f /im git.exe", 0, True
WScript.Sleep 1000

' Delete lock files
Dim lockFiles, lf
lockFiles = Array(".git\index.lock", ".git\HEAD.lock", ".git\index2.lock", ".git\index3.lock", ".git\index_new.lock")
For Each lf In lockFiles
  If oFS.FileExists(sDir & "\" & lf) Then
    On Error Resume Next
    oFS.DeleteFile sDir & "\" & lf, True
    On Error GoTo 0
  End If
Next

' Run the batch file (visible window, wait for completion)
oShell.Run "cmd /c """ & sDir & "\push_cmd.bat""", 1, True

' Read result
Dim sResult
If oFS.FileExists(sDir & "\push_output.txt") Then
  Dim oFile
  Set oFile = oFS.OpenTextFile(sDir & "\push_output.txt", 1)
  sResult = oFile.ReadAll
  oFile.Close
  MsgBox "Done!" & Chr(10) & sResult
Else
  MsgBox "No output file found"
End If
