param(
  [string]$DataDir = "C:\Code\AI\Study\backend\data",
  [string]$Out = "C:\Code\AI\Study\backend\data\platform_state.sql",
  [string]$OrgID = "org_default",
  [string]$OrgName = "默认学校"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"

Push-Location $Backend
go run .\cmd\edu-export-sql -data $DataDir -out $Out -org $OrgID -org-name $OrgName
Pop-Location

[ordered]@{
  sql = $Out
  org_id = $OrgID
  org_name = $OrgName
  next = "psql `$env:DATABASE_URL -f $Out"
} | ConvertTo-Json
