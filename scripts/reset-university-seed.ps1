param(
  [string]$DataDir = "C:\Code\AI\Study\backend\data"
)

$ErrorActionPreference = "Stop"

$statePath = Join-Path $DataDir "platform_state.json"
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"

$state = [ordered]@{
  classes = @(
    [ordered]@{ id = "class_cs_2026"; name = "计算机科学 2026 级 1 班"; grade = "大学本科"; teacher_id = "teacher_001"; archived = $false; created_at = $now; updated_at = $now }
  )
  students = @(
    [ordered]@{ id = "student_001"; name = "学生A"; class_id = "class_cs_2026"; user_id = "student_user_001"; archived = $false; created_at = $now; updated_at = $now },
    [ordered]@{ id = "student_002"; name = "学生B"; class_id = "class_cs_2026"; archived = $false; created_at = $now; updated_at = $now }
  )
  courses = @(
    [ordered]@{ id = "course_db"; name = "数据库原理"; class_id = "class_cs_2026"; archived = $false; created_at = $now; updated_at = $now }
  )
  lessons = @(
    [ordered]@{
      id = "lesson_001"
      course_id = "course_db"
      title = "关系模型与 SQL 查询基础"
      content = "数据库原理：数据模型、关系模型、主键与外键、关系代数、SQL 查询、规范化与事务 ACID。"
      file_name = ""
      analysis = [ordered]@{
        concepts = @("数据库原理", "数据模型", "关系模型", "主键与外键", "关系代数", "SQL 查询", "规范化", "事务 ACID")
        difficulties = @("关系约束理解不稳", "SQL 查询迁移不足", "规范化依赖判断困难", "事务隔离级别混淆")
        learning_path = @("激活表结构经验", "解释关系模型核心概念", "对比主键外键与完整性约束", "完成 SQL 查询迁移", "反思规范化与事务边界")
      }
      analysis_done = $true
      archived = $false
      created_at = $now
      updated_at = $now
    }
  )
  sessions = @()
  audit = @(
    [ordered]@{ id = "audit_seed_university"; actor_id = "system"; action = "system.seed"; target = "platform"; detail = "初始化大学数据库原理教学数据"; created_at = $now }
  )
  users = @(
    [ordered]@{ id = "admin_001"; username = "admin"; name = "系统管理员"; role = "admin"; class_ids = @(); active = $true; password_hash = "7a219b4990354b8455fc0789705f889060d87ca5a8de4cf0d1324ca6ff1b8096"; created_at = $now; updated_at = $now },
    [ordered]@{ id = "teacher_001"; username = "teacher"; name = "数据库原理教师"; role = "teacher"; class_ids = @("class_cs_2026"); active = $true; password_hash = "a0bdcb1ac2e3c619c8eca9366ebadc0322186eac1c3453d2fdd97c3d3bdfd506"; created_at = $now; updated_at = $now },
    [ordered]@{ id = "student_user_001"; username = "student001"; name = "学生A"; role = "student"; class_ids = @("class_cs_2026"); student_id = "student_001"; active = $true; password_hash = "6f1cc0c17892d92bea4c341b1133e8f825b13da8e1577bf7d853c4a26ee5bbde"; created_at = $now; updated_at = $now }
  )
  auth_sessions = @()
}

$state | ConvertTo-Json -Depth 100 | Set-Content $statePath -Encoding UTF8

@("student_001.json", "student_002.json", "student_smoke.json") | ForEach-Object {
  $path = Join-Path $DataDir $_
  if (Test-Path $path) { Remove-Item -LiteralPath $path }
}

[ordered]@{
  data_file = $statePath
  class = "计算机科学 2026 级 1 班"
  course = "数据库原理"
  lesson = "关系模型与 SQL 查询基础"
} | ConvertTo-Json
