param(
  [string]$DataDir = "C:\Code\AI\Study\backend\data",
  [datetime]$Since
)

$ErrorActionPreference = "Stop"

$statePath = Join-Path $DataDir "platform_state.json"
if (!(Test-Path $statePath)) {
  throw "platform_state.json not found: $statePath"
}

$state = Get-Content $statePath -Raw | ConvertFrom-Json

function As-Array($value) {
  if ($null -eq $value) { return @() }
  return @($value)
}

function In-Set($set, [string]$value) {
  return $value -and $set.ContainsKey($value)
}

function New-IdSet($items) {
  $set = @{}
  foreach ($item in As-Array $items) {
    if ($item.id) { $set[$item.id] = $true }
  }
  return $set
}

function Is-AfterSince([string]$value) {
  if ($null -eq $Since) { return $false }
  if ([string]::IsNullOrWhiteSpace($value)) { return $false }
  try {
    return ([datetime]$value) -ge $Since
  } catch {
    return $false
  }
}

$smokeClasses = As-Array $state.classes | Where-Object { $_.name -like "冒烟测试班级_*" }
$smokeClassIDs = New-IdSet $smokeClasses

$smokeCourses = As-Array $state.courses | Where-Object {
  $_.name -like "冒烟课程_*" -or (In-Set $smokeClassIDs $_.class_id)
}
$smokeCourseIDs = New-IdSet $smokeCourses

$smokeStudents = As-Array $state.students | Where-Object {
  $_.name -like "冒烟学生_*" -or (In-Set $smokeClassIDs $_.class_id)
}
$smokeStudentIDs = New-IdSet $smokeStudents

$smokeLessons = As-Array $state.lessons | Where-Object {
  $_.title -eq "冒烟测试教案" -or (In-Set $smokeCourseIDs $_.course_id)
}
$smokeLessonIDs = New-IdSet $smokeLessons

$smokeUsers = As-Array $state.users | Where-Object {
  $_.username -like "teacher_smoke_*" -or $_.username -like "student_smoke_*" -or $_.name -eq "冒烟测试教师" -or (In-Set $smokeStudentIDs $_.student_id)
}
$smokeUserIDs = New-IdSet $smokeUsers

$smokeSessions = As-Array $state.sessions | Where-Object {
  $_.student_id -eq "student_smoke" -or (In-Set $smokeStudentIDs $_.student_id) -or $_.input -eq "我想确认自己理解得对不对" -or $_.input -eq "我想确认自己对关系模型的理解是否正确"
}
$smokeSessionIDs = New-IdSet $smokeSessions

$removedTargets = @{}
foreach ($set in @($smokeClassIDs, $smokeCourseIDs, $smokeStudentIDs, $smokeLessonIDs, $smokeUserIDs, $smokeSessionIDs)) {
  foreach ($key in $set.Keys) { $removedTargets[$key] = $true }
}

$state.classes = @(As-Array $state.classes | Where-Object { -not (In-Set $smokeClassIDs $_.id) })
$state.courses = @(As-Array $state.courses | Where-Object { -not (In-Set $smokeCourseIDs $_.id) })
$state.students = @(As-Array $state.students | Where-Object { -not (In-Set $smokeStudentIDs $_.id) })
$state.lessons = @(As-Array $state.lessons | Where-Object { -not (In-Set $smokeLessonIDs $_.id) })
$state.users = @(As-Array $state.users | Where-Object { -not (In-Set $smokeUserIDs $_.id) })
$state.sessions = @(As-Array $state.sessions | Where-Object { -not (In-Set $smokeSessionIDs $_.id) })
$state.auth_sessions = @(As-Array $state.auth_sessions | Where-Object { -not (In-Set $smokeUserIDs $_.user_id) })
$state.audit = @(As-Array $state.audit | Where-Object {
  -not (In-Set $removedTargets $_.target) -and
  -not (In-Set $smokeUserIDs $_.actor_id) -and
  -not ($_.action -eq "auth.login" -and $Since -and ($_.actor_id -eq "admin_001" -or $_.actor_id -eq "student_user_001")) -and
  $_.detail -notlike "*冒烟*" -and
  $_.detail -notlike "teacher_smoke_*" -and
  $_.detail -notlike "student_smoke_*" -and
  $_.detail -ne "我不理解函数单调性" -and
  $_.detail -ne "我想确认自己理解得对不对" -and
  $_.detail -ne "我不理解关系模型和外键约束之间的关系" -and
  $_.detail -ne "我想确认自己对关系模型的理解是否正确"
})

$state | ConvertTo-Json -Depth 100 | Set-Content $statePath -Encoding UTF8

$smokeMemory = Join-Path $DataDir "student_smoke.json"
if (Test-Path $smokeMemory) {
  Remove-Item -LiteralPath $smokeMemory
}

[pscustomobject]@{
  removed_classes = $smokeClasses.Count
  removed_courses = $smokeCourses.Count
  removed_students = $smokeStudents.Count
  removed_lessons = $smokeLessons.Count
  removed_users = $smokeUsers.Count
  removed_sessions = $smokeSessions.Count
  data_file = $statePath
} | ConvertTo-Json
