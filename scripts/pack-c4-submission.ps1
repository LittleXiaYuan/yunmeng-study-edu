# pack-c4-submission.ps1
# 一键生成 C4 提交包：dist-c4\03-云元——沉浸式AI伴学系统+{TeamName}.zip
# 用法：powershell -File scripts\pack-c4-submission.ps1 -TeamName "你的队伍名"

param(
  [string]$TeamName = "云元队"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "dist-c4"
$stage = Join-Path $outDir "_stage"
$zipName = "03-云元——沉浸式AI伴学系统+$TeamName.zip"
$zipPath = Join-Path $outDir $zipName

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Write-Host "== 收集文件 ==" -ForegroundColor Cyan

# backend（排除产物与数据）
$backendDest = Join-Path $stage "backend"
robocopy (Join-Path $root "backend") $backendDest /E /XD bin data /XF *.log *.exe | Out-Null

# teacher-web-next（排除依赖与构建产物）
$webDest = Join-Path $stage "teacher-web-next"
robocopy (Join-Path $root "teacher-web-next") $webDest /E /XD node_modules .next out /XF tsconfig.tsbuildinfo | Out-Null

# dist-desktop 整个（双击即跑的演示）
if (Test-Path (Join-Path $root "dist-desktop")) {
  robocopy (Join-Path $root "dist-desktop") (Join-Path $stage "dist-desktop") /E | Out-Null
}

# harmony 骨架
if (Test-Path (Join-Path $root "harmony")) {
  robocopy (Join-Path $root "harmony") (Join-Path $stage "harmony") /E | Out-Null
}

# 参赛说明（zip 根部）
$readmeSrc = Join-Path $root "docs\competition\C4-README-参赛说明.txt"
if (Test-Path $readmeSrc) {
  Copy-Item $readmeSrc (Join-Path $stage "README-参赛说明.txt")
}

Write-Host "== 包含的顶层项 ==" -ForegroundColor Cyan
Get-ChildItem $stage | ForEach-Object { Write-Host "  - $($_.Name)" }

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item -Recurse -Force $stage
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "打包完成：$zipPath ($sizeMB MB)" -ForegroundColor Green
Write-Host "按规程上传：01-作品说明文档+$TeamName.pdf / 02-演示视频+$TeamName.mp4 / $zipName" -ForegroundColor Green
