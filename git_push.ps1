$dir = "C:\naver-economy-blog\output\components\spenlog"
$pat = "https://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@github.com/hiyazzzz/spenlog.git"
$out = "$dir\push_output.txt"

Set-Location $dir

# Kill git
taskkill /f /im git.exe 2>$null
Start-Sleep 1

# Delete lock files
$locks = @(".git\index.lock",".git\HEAD.lock",".git\index2.lock",".git\index3.lock",".git\index_new.lock")
foreach ($lk in $locks) {
    $fp = Join-Path $dir $lk
    if (Test-Path $fp) { Remove-Item $fp -Force -ErrorAction SilentlyContinue }
}

"[START]" | Out-File $out -Encoding utf8

# stash, rebase, pop, push
$cmds = @(
    "git stash",
    "git rebase origin/main",
    "git stash pop",
    "git push $pat HEAD:main"
)

foreach ($cmd in $cmds) {
    "`n[CMD] $cmd" | Add-Content $out
    $result = Invoke-Expression $cmd 2>&1
    $result | Add-Content $out
}

"[DONE]" | Add-Content $out
