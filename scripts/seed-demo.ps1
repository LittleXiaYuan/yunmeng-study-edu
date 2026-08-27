param(
  [string]$DataDir = "C:\Code\AI\Study\backend\data"
)

$ErrorActionPreference = "Stop"

$statePath = Join-Path $DataDir "platform_state.json"
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"

# ===== 演示种子数据 =====
# 目标：丰富、真实、覆盖 admin/teacher/student 三端典型场景
# 5 个班 / 32 个学生 / 4 门课 / 16 份教案 / 5 个任务（含已发布、草稿、已归档）
# 典型成绩：一些学生 100% 完成、一些进行中、一些未开始

$classes = @(
  [ordered]@{ id = "class_cs_2026";     name = "计算机科学 2026 级 1 班";   grade = "大学本科"; teacher_id = "teacher_001"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "class_se_2026";     name = "软件工程 2026 级 2 班";     grade = "大学本科"; teacher_id = "teacher_001"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "class_ai_2025";     name = "人工智能 2025 级 1 班";     grade = "大学本科"; teacher_id = "teacher_001"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "class_ds_2025";     name = "数据科学 2025 级 1 班";     grade = "大学本科"; teacher_id = "teacher_001"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "class_alumni_2024"; name = "校友群 2024 届（已结业）";   grade = "校友";     teacher_id = "teacher_001"; archived = $true;  created_at = $now; updated_at = $now }
)

$students = @()
$i = 0
$names = @("张伟","王芳","李娜","刘强","陈静","杨阳","赵磊","黄丽","周杰","吴敏",
          "徐磊","孙丽","马超","朱琳","胡军","郭涛","林峰","何静","高翔","罗倩",
          "梁宇","宋杰","谢娜","唐艺昕","韩雪","冯程程","邓超","曹颖","彭于晏","蒋欣",
          "沈腾","贾玲")
foreach ($cls in $classes) {
  if ($cls.archived) { continue }
  $count = switch ($cls.id) {
    "class_cs_2026" { 10 }
    "class_se_2026" { 8 }
    "class_ai_2025" { 7 }
    "class_ds_2025" { 7 }
    default { 0 }
  }
  for ($k = 0; $k -lt $count; $k++) {
    $i++
    $name = $names[[Math]::Min($i - 1, $names.Count - 1)]
    $sid = "student_{0:D3}" -f $i
    $students += [ordered]@{
      id        = $sid
      name      = $name
      class_id  = $cls.id
      user_id   = "user_$sid"
      archived  = $false
      created_at = $now
      updated_at = $now
    }
  }
}

$courses = @(
  [ordered]@{ id = "course_db";   name = "数据库原理";   class_id = "class_cs_2026"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "course_os";   name = "操作系统";     class_id = "class_se_2026"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "course_ml";   name = "机器学习导论"; class_id = "class_ai_2025"; archived = $false; created_at = $now; updated_at = $now }
  [ordered]@{ id = "course_stat"; name = "统计学习方法"; class_id = "class_ds_2025"; archived = $false; created_at = $now; updated_at = $now }
)

$lessonSpecs = @(
  # (courseId, lessonId, title, content, concepts, difficulties, learningPath)
  @{ cid = "course_db";   lid = "lesson_db_01"; title = "关系模型与 SQL 查询基础";   concepts = @("数据库原理","关系模型","主键外键","SQL 查询","规范化","事务 ACID"); difficulties = @("外键约束不稳","复杂查询迁移弱","规范化判断难","事务隔离混淆"); path = @("激活表结构经验","解释关系模型","对比主外键","完成 SQL 迁移") }
  @{ cid = "course_db";   lid = "lesson_db_02"; title = "索引原理与查询优化";         concepts = @("B+ 树","聚簇索引","覆盖索引","查询计划","成本估算");      difficulties = @("索引选择性误判","复合索引顺序","最左前缀误解");          path = @("回顾 B+ 树结构","对比聚簇/非聚簇","EXPLAIN 实操","覆盖索引收益") }
  @{ cid = "course_db";   lid = "lesson_db_03"; title = "事务与并发控制";             concepts = @("ACID","脏读","不可重复读","幻读","两阶段锁","MVCC");     difficulties = @("隔离级别选错","死锁排查","MVCC 视图理解");               path = @("梳理 ACID","对比四个隔离级别","死锁日志","MVCC undo log") }
  @{ cid = "course_db";   lid = "lesson_db_04"; title = "分布式事务与一致性";         concepts = @("CAP","BASE","2PC","TCC","Saga");                            difficulties = @("CAP 取舍不清","补偿逻辑设计","幂等保证");                  path = @("CAP 三选二","BASE vs 强一致","2PC 流程","Saga 补偿") }
  @{ cid = "course_os";   lid = "lesson_os_01"; title = "进程与线程";                 concepts = @("PCB","上下文切换","调度算法","线程池");                   difficulties = @("进程/线程边界","死锁四要素","调度延迟分析");            path = @("回顾 PCB","对比调度算法","手写线程池","死锁演示") }
  @{ cid = "course_os";   lid = "lesson_os_02"; title = "内存管理：分页与置换";       concepts = @("虚拟内存","页表","TLB","Clock 置换","工作集");             difficulties = @("页表大小","TLB 命中率","颠簸分析");                      path = @("虚存由来","页表结构","TLB 加速","Clock 实战") }
  @{ cid = "course_os";   lid = "lesson_os_03"; title = "文件系统与日志";             concepts = @("inode","日志文件系统","fsck","写前日志 WAL");            difficulties = @("inode 与文件大小","WAL 恢复","fsck 流程");                  path = @("inode 三列表","WAL 写入","崩溃恢复","fsck 实操") }
  @{ cid = "course_os";   lid = "lesson_os_04"; title = "进程间通信：信号量与共享内存"; concepts = @("管道","消息队列","共享内存","信号量","mmap");            difficulties = @("共享内存同步","信号量丢失唤醒","mmap 同步");                path = @("管道 vs 消息队列","共享内存陷阱","信号量实现","mmap 加速 IO") }
  @{ cid = "course_ml";   lid = "lesson_ml_01"; title = "监督学习与损失函数";         concepts = @("经验风险","损失函数","梯度下降","正则化","泛化");        difficulties = @("损失选择","学习率","过拟合判别");                       path = @("MSE vs 交叉熵","梯度推导","L1/L2","偏差方差分解") }
  @{ cid = "course_ml";   lid = "lesson_ml_02"; title = "决策树与集成学习";           concepts = @("信息增益","基尼系数","Bagging","Boosting","随机森林");   difficulties = @("信息增益 vs 基尼","过拟合控制","XGBoost 调参");            path = @("ID3/C4.5/CART","Bagging 减方差","Boosting 减偏差","XGBoost 实战") }
  @{ cid = "course_ml";   lid = "lesson_ml_03"; title = "支持向量机与核方法";         concepts = @("超平面","对偶问题","核函数","软间隔","SMO");              difficulties = @("几何直觉","核函数选择","SMO 推导");                       path = @("间隔最大化","对偶推导","核技巧","SMO 算法") }
  @{ cid = "course_ml";   lid = "lesson_ml_04"; title = "神经网络与反向传播";         concepts = @("感知机","激活函数","BP 算法","梯度消失","Xavier");       difficulties = @("梯度推导","激活函数选择","初始化","学习率衰减");         path = @("感知机几何","BP 链式法则","激活函数对比","Xavier/He 初始化") }
  @{ cid = "course_stat"; lid = "lesson_stat_01"; title = "统计推断基础";              concepts = @("抽样分布","点估计","置信区间","假设检验");                difficulties = @("p 值误读","多重比较","置信区间解释");                    path = @("抽样分布推导","MLE/MoM","置信区间构造","p 值与功效") }
  @{ cid = "course_stat"; lid = "lesson_stat_02"; title = "线性回归与正则化";           concepts = @("OLS","Ridge","Lasso","ElasticNet","偏差方差");            difficulties = @("多重共线","正则化选择","超参调优");                       path = @("OLS 推导","Ridge 闭式解","Lasso 稀疏性","交叉验证") }
  @{ cid = "course_stat"; lid = "lesson_stat_03"; title = "分类与逻辑回归";             concepts = @("Sigmoid","对数似然","多分类 softmax","评估指标");          difficulties = @("类别不平衡","阈值选择","多分类扩展");                     path = @("Sigmoid 由来","对数似然","Softmax 推广","PR vs ROC") }
  @{ cid = "course_stat"; lid = "lesson_stat_04"; title = "降维与聚类";                 concepts = @("PCA","SVD","K-means","层次聚类","DBSCAN");                difficulties = @("方差解释","K 选择","噪声鲁棒");                            path = @("PCA 推导","SVD 与 PCA 关系","K-means 收敛","DBSCAN 优势") }
)

$lessons = @()
foreach ($s in $lessonSpecs) {
  $lessons += [ordered]@{
    id        = $s.lid
    course_id = $s.cid
    title     = $s.title
    content   = $s.title + "：" + ($s.concepts -join "、") + "。"
    file_name = ""
    analysis  = [ordered]@{
      concepts      = $s.concepts
      difficulties  = $s.difficulties
      learning_path = $s.path
    }
    analysis_done = $true
    archived     = $false
    created_at   = $now
    updated_at   = $now
  }
}

# 任务：5 个（3 已发布、1 草稿、1 已归档）
$homeworks = @(
  [ordered]@{ id = "hw_db_01"; title = "关系模型基础练习"; class_id = "class_cs_2026"; course_id = "course_db"; lesson_id = "lesson_db_01"; published = $true;  archived = $false
    steps = @(
      [ordered]@{ index = 0; prompt = "用一句话解释什么是主键（primary key）"; expected = "唯一标识一行、不可重复、不可为空" }
      [ordered]@{ index = 1; prompt = "举一个外键的真实例子（学生-班级）";   expected = "学生表 class_id 引用班级表 id" }
      [ordered]@{ index = 2; prompt = "为什么需要外键约束？";                   expected = "保证引用完整性、避免孤儿记录" }
    )
    created_at = $now; updated_at = $now
  },
  [ordered]@{ id = "hw_db_02"; title = "SQL 多表连接练习"; class_id = "class_cs_2026"; course_id = "course_db"; lesson_id = "lesson_db_01"; published = $true;  archived = $false
    steps = @(
      [ordered]@{ index = 0; prompt = "用 INNER JOIN 查'选了数据库课的学生姓名'"; expected = "SELECT s.name FROM student s JOIN course c ON ..." }
      [ordered]@{ index = 1; prompt = "LEFT JOIN 和 INNER JOIN 区别";                 expected = "LEFT 保留左表全部；INNER 只保留匹配" }
    )
    created_at = $now; updated_at = $now
  },
  [ordered]@{ id = "hw_db_03"; title = "事务隔离级别辨析"; class_id = "class_cs_2026"; course_id = "course_db"; lesson_id = "lesson_db_03"; published = $true;  archived = $false
    steps = @(
      [ordered]@{ index = 0; prompt = "举一个'脏读'的实际场景"; expected = "事务 A 读到事务 B 未提交的数据" }
    )
    created_at = $now; updated_at = $now
  },
  [ordered]@{ id = "hw_db_04_draft"; title = "索引设计实战（草稿）"; class_id = "class_cs_2026"; course_id = "course_db"; lesson_id = "lesson_db_02"; published = $false; archived = $false
    steps = @(
      [ordered]@{ index = 0; prompt = "为 students(name, age) 表设计索引"; expected = "考虑最左前缀原则" }
    )
    created_at = $now; updated_at = $now
  },
  [ordered]@{ id = "hw_db_old"; title = "数据库基础（已归档）"; class_id = "class_alumni_2024"; course_id = "course_db"; lesson_id = "lesson_db_01"; published = $true;  archived = $true
    steps = @()
    created_at = $now; updated_at = $now
  }
)

# 学生作业提交：典型成绩分布
# 10 个学生 × hw_db_01：3 个全过、4 个进行中（1-2 步）、3 个未开始
$attempts = @()
$csStudents = $students | Where-Object { $_.class_id -eq "class_cs_2026" }
$idx = 0
foreach ($s in $csStudents) {
  $idx++
  $pattern = $idx % 4
  $userId = $s.user_id
  switch ($pattern) {
    0 {
      # 全过
      $attempts += [ordered]@{ id = "att_{0}_db01_0" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 0; answer = "主键是用来唯一标识表中每一行数据的字段，不可重复、不可为空。"; guidance = "准确抓住了唯一性、不可空两个核心点。"; score = 90; completed_step = $true; created_at = $now }
      $attempts += [ordered]@{ id = "att_{0}_db01_1" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 1; answer = "学生表 class_id 引用班级表 id。";                              guidance = "例子具体、方向对。可以再补一个一对一、一对多对比。"; score = 85; completed_step = $true; created_at = $now }
      $attempts += [ordered]@{ id = "att_{0}_db01_2" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 2; answer = "保证数据一致、避免孤儿记录。";                                  guidance = "简洁有力。下次可以补一句'参照完整性'。";                  score = 80; completed_step = $true; created_at = $now }
    }
    1 {
      # 进行中 1 步
      $attempts += [ordered]@{ id = "att_{0}_db01_0" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 0; answer = "唯一标识一行"; guidance = "答得不完整。想想：主键还有什么关键特征？"; score = 60; completed_step = $true; created_at = $now }
    }
    2 {
      # 进行中 2 步
      $attempts += [ordered]@{ id = "att_{0}_db01_0" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 0; answer = "主键唯一标识表中的每一行，且不能为空。"; guidance = "准确。"; score = 85; completed_step = $true; created_at = $now }
      $attempts += [ordered]@{ id = "att_{0}_db01_1" -f $s.id; user_id = $userId; student_id = $s.id; homework_id = "hw_db_01"; step_index = 1; answer = "学生 class_id → 班级 id"; guidance = "能举出一个例子。但 '外键' 定义还没说出来。"; score = 75; completed_step = $true; created_at = $now }
    }
    default {
      # 未开始
    }
  }
}

# 用户
$users = @(
  [ordered]@{ id = "admin_001";         username = "admin";      name = "系统管理员";     role = "admin";   class_ids = @();                                  active = $true;  password_hash = "7a219b4990354b8455fc0789705f889060d87ca5a8de4cf0d1324ca6ff1b8096"; created_at = $now; updated_at = $now },
  [ordered]@{ id = "teacher_001";       username = "teacher";    name = "数据库原理教师"; role = "teacher"; class_ids = @("class_cs_2026","class_se_2026","class_ai_2025","class_ds_2025"); active = $true; password_hash = "a0bdcb1ac2e3c619c8eca9366ebadc0322186eac1c3453d2fdd97c3d3bdfd506"; created_at = $now; updated_at = $now }
  [ordered]@{ id = "student_user_001";  username = "student001"; name = "张伟";           role = "student"; class_ids = @("class_cs_2026");                  student_id = "student_001"; active = $true;  password_hash = "6f1cc0c17892d92bea4c341b1133e8f825b13da8e1577bf7d853c4a26ee5bbde"; created_at = $now; updated_at = $now }
)

# 为每个学生补一个 user（密码 student123456）
$studentUsers = @()
foreach ($s in $students) {
  $studentUsers += [ordered]@{
    id        = $s.user_id
    username  = "u_$($s.id)"
    name      = $s.name
    role      = "student"
    class_ids = @($s.class_id)
    student_id = $s.id
    active    = $true
    password_hash = "6f1cc0c17892d92bea4c341b1133e8f825b13da8e1577bf7d853c4a26ee5bbde"
    created_at = $now
    updated_at = $now
  }
}

$state = [ordered]@{
  classes   = $classes
  students  = $students
  courses   = $courses
  lessons   = $lessons
  homeworks = $homeworks
  homework_attempts = $attempts
  sessions  = @()
  audit     = @(
    [ordered]@{ id = "audit_seed_demo"; actor_id = "system"; action = "system.seed"; target = "platform"; detail = "初始化演示种子数据：5 班 / 32 学生 / 4 课 / 16 教案 / 5 任务 / 若干提交"; created_at = $now }
  )
  users         = $users + $studentUsers
  auth_sessions = @()
}

$state | ConvertTo-Json -Depth 100 | Set-Content $statePath -Encoding UTF8

# 清理旧的学生 memory 文件
Get-ChildItem -Path $DataDir -Filter "student_*.json" -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
}

# 清理 SQLite（如果存在）—— 演示数据用 JSON 后端，避免 sqlite 持久化
$sqlitePath = Join-Path $DataDir "study.db"
if (Test-Path $sqlitePath) {
  Remove-Item -LiteralPath $sqlitePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath "$sqlitePath-wal" -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath "$sqlitePath-shm" -Force -ErrorAction SilentlyContinue
}

[ordered]@{
  data_file = $statePath
  classes   = $classes.Count
  students  = $students.Count
  courses   = $courses.Count
  lessons   = $lessons.Count
  homeworks = $homeworks.Count
  attempts  = $attempts.Count
  note      = "演示数据。启动后端时不要用 SQLite driver，让它从 platform_state.json 重新初始化。"
} | ConvertTo-Json
