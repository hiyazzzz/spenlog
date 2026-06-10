Dim oShell, oFS, sDir
Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")
sDir = "C:\naver-economy-blog\output\components\spenlog"
oShell.Run "powershell.exe -ExecutionPolicy Bypass -File """ & sDir & "\finish_rebase.ps1""", 1, True
Dim sResult
If oFS.FileExists(sDir & "\finish_output.txt") Then
  Dim oFile
  Set oFile = oFS.OpenTextFile(sDir & "\finish_output.txt", 1)
  sResult = oFile.ReadAll
  oFile.Close
  MsgBox sResult
Else
  MsgBox "finish_output.txt not found"
End If
