Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

sDir = "C:\naver-economy-blog\output\components\spenlog"

' Delete lock files
On Error Resume Next
oFS.DeleteFile sDir & "\.git\index.lock", True
oFS.DeleteFile sDir & "\.git\HEAD.lock", True
On Error GoTo 0

' Run git commands
oShell.CurrentDirectory = sDir
oShell.Run "cmd /c git config user.email ""bot@spenlog.app"" && git config user.name ""Claude"" && git add src\app\api\ai-input\route.ts && git commit -m ""fix: AI 파싱 amount 타입 버그 수정 + 프롬프트 개선"" && git push https://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@github.com/hiyazzzz/spenlog.git HEAD:main > C:\naver-economy-blog\output\components\spenlog\git_result.txt 2>&1", 1, True

' Show result
Set oFile = oFS.OpenTextFile(sDir & "\git_result.txt", 1)
MsgBox oFile.ReadAll, 0, "Git Push Result"
oFile.Close
