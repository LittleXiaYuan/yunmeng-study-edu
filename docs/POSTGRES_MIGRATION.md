# PostgreSQL 生产化迁移说明

## 当前策略

当前系统仍以 JSON 存储作为默认运行模式，保证现有闭环稳定不被破坏。
本轮已补齐 PostgreSQL 生产化迁移资产：

- `backend/migrations/001_init_postgres.sql`：生产库 schema
- `backend/cmd/edu-export-sql`：把现有 JSON 数据导出为可执行 SQL
- `docker-compose.postgres.yml`：PostgreSQL + 后端 + 教师端 + 学生端组合
- `scripts/export-json-to-postgres-sql.ps1`：一键导出 SQL

## 1. 启动 PostgreSQL 版本环境

```powershell
cd C:\Code\AI\Study
Copy-Item .env.example .env
# 修改 .env 中 POSTGRES_PASSWORD / PUBLIC_API_BASE_URL 等配置
docker compose -f docker-compose.postgres.yml up -d --build
```

PostgreSQL 地址：

```text
127.0.0.1:15432
库名：study
用户：study
密码：study123456
```

## 2. 导出现有 JSON 数据为 SQL

```powershell
cd C:\Code\AI\Study
.\scripts\export-json-to-postgres-sql.ps1
```

默认输出：

```text
C:\Code\AI\Study\backend\data\platform_state.sql
```

## 3. 导入 SQL 到 PostgreSQL

本机有 psql 时：

```powershell
$env:DATABASE_URL='postgres://study:study123456@127.0.0.1:15432/study?sslmode=disable'
psql $env:DATABASE_URL -f C:\Code\AI\Study\backend\data\platform_state.sql
```

没有 psql 时，用 Docker：

```powershell
docker cp C:\Code\AI\Study\backend\data\platform_state.sql study-postgres-1:/tmp/platform_state.sql
docker exec -it study-postgres-1 psql -U study -d study -f /tmp/platform_state.sql
```

## 4. SaaS 表结构说明

核心表：

- `organizations`：学校/机构，多租户根表
- `users`：管理员、教师、学生账号
- `classes`：班级
- `students`：学生档案
- `courses`：课程
- `lessons`：教案与 TeacherAgent 分析结果
- `homeworks`：分步作业定义
- `homework_attempts`：学生每步提交与 Agent 引导结果
- `learning_sessions`：元认知 workflow 会话
- `student_memories`：学生画像
- `audit_logs`：审计日志
- `auth_sessions`：登录会话
- `llm_configs`：机构级 LLM 配置

## 5. 下一步切换后端存储驱动

当前 `EDU_STORAGE_DRIVER=json`，PostgreSQL schema 和数据迁移已准备好。
下一步要做的是实现 Go 后端 `PostgresPlatformStore`，并通过：

```env
EDU_STORAGE_DRIVER=postgres
DATABASE_URL=postgres://study:study123456@postgres:5432/study?sslmode=disable
```

切换生产数据库。

建议切换顺序：

1. 保留 JSON 线上运行
2. 部署 PostgreSQL schema
3. 导出 JSON SQL 并导入 PostgreSQL
4. 做只读比对：dashboard / users / homework count
5. 实现 `PostgresPlatformStore`
6. 灰度切换 `EDU_STORAGE_DRIVER=postgres`
7. 停止写 JSON

## 6. 为什么不直接替换

当前教学闭环已经可用。直接替换数据层风险较高，所以采用“迁移资产先完备，运行驱动后切换”的生产节奏。
