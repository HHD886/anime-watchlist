$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
function Finish([string]$message) { Write-Host $message; Read-Host '按回车键关闭'; exit }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Finish '请先安装 Git for Windows，或双击 editor.html 使用网页内一键发布。' }
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择从作品库导出的 JSON 备份（普通或加密均可）'
$dialog.Filter = 'JSON (*.json)|*.json'
if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Finish '已取消。' }
$jsonText = [IO.File]::ReadAllText($dialog.FileName, [Text.Encoding]::UTF8)
$parsed = $jsonText | ConvertFrom-Json
if (-not ($parsed -is [System.Array]) -and $null -eq $parsed.items -and -not $parsed.encrypted) { Finish '未找到作品数组或加密作品数据。' }
if (-not $parsed.encrypted) { Write-Host '此备份未加密。发布到公开仓库后，标题、评分和评语可被访问。' }
$repoUrl = Read-Host '输入已有仓库 HTTPS 地址，例如 https://github.com/用户名/anime-watchlist.git'
if ($repoUrl -notmatch '^https://github\.com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$') { Finish '请输入正确的 GitHub HTTPS 仓库地址。' }
$branch = Read-Host '发布分支（直接回车使用 main）'
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }
$stagingPath = Join-Path ([IO.Path]::GetTempPath()) ('hhd-workshelf-' + [Guid]::NewGuid().ToString('N'))
git clone --single-branch --branch $branch $repoUrl $stagingPath
if ($LASTEXITCODE -ne 0) { Finish '克隆失败。请确认仓库已有该分支，并在 Git 登录窗口完成授权。' }
$confirm = Read-Host '将用所选备份更新远程作品库，其他仓库文件保持不变。输入 YES 继续'
if ($confirm -cne 'YES') { Finish ('已取消。临时目录：' + $stagingPath) }
$utf8 = New-Object Text.UTF8Encoding($false)
foreach ($page in @('editor.html', 'index.html')) {
    $html = [IO.File]::ReadAllText((Join-Path $projectRoot $page), [Text.Encoding]::UTF8)
    $role = if ($page -eq 'editor.html') { 'editor' } else { 'viewer' }
    $boot = @{ role = $role; seed = @{ items = @() } } | ConvertTo-Json -Compress -Depth 5
    $replacement = '<script id="boot-data" type="application/json">' + $boot + '</script>'
    $clean = [regex]::Replace($html, '(?s)<script id="boot-data" type="application/json">.*?</script>', $replacement)
    if ($clean -eq $html -and $html -notmatch '"items":\[\]') { Finish '无法清理网页内置数据，已停止发布。请使用 editor.html 内发布按钮。' }
    [IO.File]::WriteAllText((Join-Path $stagingPath $page), $clean, $utf8)
}
[IO.File]::WriteAllText((Join-Path $stagingPath 'data.json'), $jsonText, $utf8)
foreach ($name in @('sw.js', 'icon.svg', 'manifest.webmanifest', '.nojekyll')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $stagingPath $name) -Force }
git -C $stagingPath add -- index.html editor.html data.json sw.js icon.svg manifest.webmanifest .nojekyll
git -C $stagingPath diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Finish '文件内容相同，没有需要发布的修改。' }
git -C $stagingPath commit -m ('Update HHD workshelf ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
if ($LASTEXITCODE -ne 0) { Finish ('提交失败，请检查 Git 姓名与邮箱设置。准备好的文件保留在：' + $stagingPath) }
git -C $stagingPath push origin $branch
if ($LASTEXITCODE -ne 0) { Finish ('推送未完成，未强制覆盖远程分支。请检查登录和冲突。文件保留在：' + $stagingPath) }
Finish '已推送到 GitHub。请等待 Pages 构建完成。第一次需在仓库 Settings → Pages 选择分支与 /(root)。'
