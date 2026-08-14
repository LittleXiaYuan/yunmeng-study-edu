$ErrorActionPreference = "Stop"

$base = if ($env:EDU_BASE_URL) { $env:EDU_BASE_URL } else { "http://127.0.0.1:18080" }
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$smokeStarted = Get-Date
$defaultClassID = "class_cs_2026"
$defaultCourseID = "course_db"
$defaultLessonContent = "数据库原理：数据模型、关系模型、主键与外键、关系代数、SQL 查询、规范化与事务 ACID。"

Write-Host "Health..."
Invoke-RestMethod -Uri "$base/healthz" -Method Get | ConvertTo-Json

Write-Host "Login..."
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{
  username = "admin"
  password = "admin123456"
} | ConvertTo-Json)
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
$login | ConvertTo-Json -Depth 6

Write-Host "Create user..."
$suffix = Get-Date -Format "yyyyMMddHHmmss"
$createdUser = Invoke-RestMethod -Uri "$base/users" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  username = "teacher_smoke_$suffix"
  password = "teacher123456"
  name = "冒烟测试教师"
  role = "teacher"
  class_ids = @($defaultClassID)
} | ConvertTo-Json)
$createdUser | ConvertTo-Json -Depth 8

Write-Host "Disable user..."
Invoke-RestMethod -Uri "$base/users/update" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  id = $createdUser.id
  active = $false
} | ConvertTo-Json) | ConvertTo-Json -Depth 8

Write-Host "Create class/course/student..."
$class = Invoke-RestMethod -Uri "$base/edu/classes" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  name = "冒烟测试班级_$suffix"
  grade = "大学本科"
  teacher_id = "teacher_001"
} | ConvertTo-Json)
$class | ConvertTo-Json -Depth 8
$course = Invoke-RestMethod -Uri "$base/edu/courses" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  name = "冒烟课程_$suffix"
  class_id = $class.id
} | ConvertTo-Json)
$course | ConvertTo-Json -Depth 8
$student = Invoke-RestMethod -Uri "$base/edu/students" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  name = "冒烟学生_$suffix"
  class_id = $class.id
  create_user = $true
  username = "student_smoke_$suffix"
  password = "student123456"
} | ConvertTo-Json)
$student | ConvertTo-Json -Depth 8

Write-Host "Archive and restore student/course..."
Invoke-RestMethod -Uri "$base/edu/students" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  id = $student.id
  archived = $true
} | ConvertTo-Json) | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "$base/edu/students" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  id = $student.id
  archived = $false
} | ConvertTo-Json) | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "$base/edu/courses" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  id = $course.id
  archived = $true
} | ConvertTo-Json) | ConvertTo-Json -Depth 8

Write-Host "Create lesson..."
Invoke-RestMethod -Uri "$base/edu/lessons" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  course_id = $defaultCourseID
  title = "冒烟测试教案"
  content = $defaultLessonContent
} | ConvertTo-Json) | ConvertTo-Json -Depth 8

Write-Host "Run workflow..."
Invoke-RestMethod -Uri "$base/edu/workflow" -Method Post -Headers $headers -ContentType "application/json" -Body (@{
  student_id = "student_smoke"
  course_id = $defaultCourseID
  class_id = $defaultClassID
  lesson_content = $defaultLessonContent
  student_input = "我不理解关系模型和外键约束之间的关系"
  student_answer = "我认为关系模型用表表示实体和联系，例如学生表和选课表。我的反思是要注意引用完整性。"
} | ConvertTo-Json) | ConvertTo-Json -Depth 8

Write-Host "Dashboard..."
Invoke-RestMethod -Uri "$base/edu/dashboard" -Method Get -Headers $headers | ConvertTo-Json -Depth 8

Write-Host "List endpoints..."
Invoke-RestMethod -Uri "$base/edu/classes" -Method Get -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/edu/courses" -Method Get -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/edu/students" -Method Get -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/edu/lessons" -Method Get -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/edu/sessions" -Method Get -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/edu/audit" -Method Get -Headers $headers | ConvertTo-Json -Depth 6

Write-Host "Student RBAC..."
$studentLogin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{
  username = "student001"
  password = "student123456"
} | ConvertTo-Json)
$studentHeaders = @{ Authorization = "Bearer $($studentLogin.token)" }

try {
  Invoke-RestMethod -Uri "$base/edu/lessons" -Method Post -Headers $studentHeaders -ContentType "application/json" -Body (@{
    course_id = $defaultCourseID
    title = "学生越权教案"
    content = "should be forbidden"
  } | ConvertTo-Json) | Out-Null
  throw "student was allowed to create lesson"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw }
  Write-Host "Student lesson creation forbidden: OK"
}

Invoke-RestMethod -Uri "$base/edu/workflow" -Method Post -Headers $studentHeaders -ContentType "application/json" -Body (@{
  student_id = "student_002"
  course_id = $defaultCourseID
  class_id = $defaultClassID
  lesson_content = $defaultLessonContent
  student_input = "我想确认自己对关系模型的理解是否正确"
  student_answer = "我认为关系模型把数据组织成二维表，主键唯一标识元组，外键用于表达表之间的引用关系。"
} | ConvertTo-Json) | ConvertTo-Json -Depth 8

Write-Host "Cleanup smoke data..."
& (Join-Path $scriptDir "cleanup-smoke-data.ps1") -Since $smokeStarted
