$dir = "C:\naver-economy-blog\output\components\spenlog"
$pat = "https://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@github.com/hiyazzzz/spenlog.git"
$out = "$dir\finish_output.txt"

Set-Location $dir

"[START]" | Out-File $out -Encoding utf8

# Kill git and delete locks
taskkill /f /im git.exe 2>$null
Start-Sleep 1
$locks = @(".git\index.lock",".git\HEAD.lock",".git\index2.lock",".git\index3.lock",".git\index_new.lock")
foreach ($lk in $locks) {
    $fp = Join-Path $dir $lk
    if (Test-Path $fp) { Remove-Item $fp -Force -ErrorAction SilentlyContinue }
}

# git add resolved files
"`n[CMD] git add" | Add-Content $out
$r = & git add src/app/api/ai-input/route.ts vercel.json 2>&1
$r | Add-Content $out

# GIT_EDITOR=true to skip editor on rebase --continue
$env:GIT_EDITOR = "true"

"`n[CMD] git rebase --continue" | Add-Content $out
$r = & git -c core.editor=true rebase --continue 2>&1
$r | Add-Content $out

# push
"`n[CMD] git push" | Add-Content $out
$r = & git push $pat HEAD:main 2>&1
$r | Add-Content $out

"[DONE]" | Add-Content $out
Get-Content $out
