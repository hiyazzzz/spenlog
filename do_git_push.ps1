# UTF-8 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$repo = "C:\Users\curio\Desktop\spenlog"
Set-Location $repo

# git 경로 탐색
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe"
)
$git = $null
foreach ($p in $gitPaths) {
    if (Test-Path $p) { $git = $p; break }
}
if (-not $git) { $git = "git" }

Write-Host "Git: $git"

# 1. lock 파일 삭제
$lock = Join-Path $repo ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "[1] index.lock 삭제 완료"
} else {
    Write-Host "[1] lock 파일 없음"
}

# 2. git config
& $git config user.email "curious9733@gmail.com"
& $git config user.name "spenlog"
Write-Host "[2] git config 완료"

# 3. git add
& $git add -A
Write-Host "[3] git add 완료"

# 4. git commit (메시지를 파일로 저장해서 인코딩 문제 회피)
$msg = "feat: 카테고리 드래그 리오더 + 한줄기록 확인팝업 + 고정비 폼 연결계좌 + 버그수정 다수"
$msgFile = Join-Path $env:TEMP "commit_msg.txt"
[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.Encoding]::UTF8)
& $git commit -F $msgFile
Write-Host "[4] git commit 완료"

# 5. git push
& $git push origin main
Write-Host "[5] git push 완료"

Write-Host ""
Write-Host "=== 모두 완료 ==="
Read-Host "엔터를 누르면 닫힙니다"
