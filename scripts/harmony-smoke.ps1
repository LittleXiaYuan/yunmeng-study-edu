# harmony-smoke.ps1
# 模拟鸿蒙入口（小艺 Agent / HAP 壳）触发云元伴学对话的冒烟验证。
# 用法：
#   1) 先启动后端：  cd backend; go run .\cmd\edu-server
#   2) 另开终端：     powershell -File scripts\harmony-smoke.ps1
# 期望输出：HARMONY SMOKE PASS

param(
  [string]$BaseUrl = "http://127.0.0.1:18080",
  [string]$StudentUser = "student001",
  [string]$StudentPass = "student123456"
)

$ErrorActionPreference = "Stop"

function Fail($msg) {
  Write-Host "HARMONY SMOKE FAIL: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "[1/3] 登录学生账号 $StudentUser ..." -ForegroundColor Cyan
try {
  $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" `
    -ContentType "application/json; charset=utf-8" `
    -Body (@{ username = $StudentUser; password = $StudentPass } | ConvertTo-Json)
} catch {
  Fail "无法登录或后端未启动（请先运行: cd backend; go run .\cmd\edu-server）。$($_.Exception.Message)"
}
if (-not $login.token) { Fail "登录响应缺少 token" }
$token = $login.token
$studentId = $login.user.student_id
if (-not $studentId) { $studentId = "student_001" }
Write-Host "    token 获取成功，student_id=$studentId"

$headers = @{ Authorization = "Bearer $token" }

Write-Host "[2/3] 带 page_context 调 /edu/chat（模拟鸿蒙入口伴学）..." -ForegroundColor Cyan
$chatBody = @{
  student_id = $studentId
  course_id  = "course_db"
  question   = "这一步我该怎么想？"
  history    = @()
  page_context = @{
    scene        = "homework_step"
    title        = "图书馆借阅库设计"
    step_title   = "第1步 识别实体"
    instruction  = "找出借书场景中的实体与属性"
    student_draft = "我写了读者和图书两个实体"
  }
} | ConvertTo-Json -Depth 6

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/edu/chat" `
    -Headers $headers -ContentType "application/json; charset=utf-8" -Body $chatBody
} catch {
  Fail "/edu/chat 调用失败：$($_.Exception.Message)"
}

if (-not $resp.message -or $resp.message.Trim().Length -eq 0) {
  Fail "伴学回复为空"
}
# 苏格拉底特性：回复必须是引导（含问号），不能是直接答案
if ($resp.message -notmatch "[？?]") {
  Fail "回复不含引导性提问（云元教练应以提问结尾）：$($resp.message)"
}
$trustLevel = $resp.trust.level
if (-not $trustLevel) { Fail "响应缺少 trust.level（信任分门控未生效）" }

Write-Host "    伴学回复：$($resp.message.Substring(0, [Math]::Min(60, $resp.message.Length)))..."
Write-Host "[3/3] 信任分门控：score=$($resp.trust.score) level=$trustLevel ($($resp.trust.description))" -ForegroundColor Cyan

Write-Host "HARMONY SMOKE PASS" -ForegroundColor Green
