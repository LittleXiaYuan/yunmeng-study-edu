param(
  [ValidateSet("dev", "prod")]
  [string]$Mode = "prod",
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "[1/3] Validate backend..."
Push-Location "$Root\backend"
go test ./...
go build -o bin\edu-server.exe .\cmd\edu-server
Pop-Location

Write-Host "[2/3] Validate web (teacher-web-next)..."
Push-Location "$Root\teacher-web-next"
if (-not (Test-Path "node_modules")) {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}
npm run build
if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
Pop-Location

if ($BuildOnly) {
  Write-Host "BuildOnly enabled; skip docker compose startup."
  exit 0
}

Write-Host "[3/3] Start docker compose ($Mode)..."
$composeFile = if ($Mode -eq "prod") { "docker-compose.prod.yml" } else { "docker-compose.yml" }
docker compose -f $composeFile up -d --build

Write-Host "Waiting backend health..."
$base = if ($env:PUBLIC_API_BASE_URL) { $env:PUBLIC_API_BASE_URL } else { "http://127.0.0.1:18080" }
for ($i = 1; $i -le 30; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "$base/healthz" -TimeoutSec 3
    if ($health.status -eq "ok") { break }
  } catch {
    Start-Sleep -Seconds 2
  }
}

& "$PSScriptRoot\smoke-test.ps1"

$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } elseif ($env:TEACHER_PORT) { $env:TEACHER_PORT } else { "18081" }
[ordered]@{
  backend = $base
  web     = "http://127.0.0.1:$webPort"
  compose = $composeFile
} | ConvertTo-Json
