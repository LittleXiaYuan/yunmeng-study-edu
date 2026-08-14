# Self-Evolving Teaching System（云元——沉浸式AI伴学系统）

科研级 AI 教学闭环系统，独立运行于本目录。云雀仅作为 HTTP `/v1` Agent 能力来源，不修改云雀项目源码。

默认课程场景：大学本科《数据库原理》，覆盖关系模型、SQL 查询、规范化、事务 ACID 等教学内容。

**C4 参赛方向**：鸿蒙赛道 · Agent 创新。鸿蒙接入见 `harmony/`（小艺 openapi 技能定义 + ArkTS 壳骨架），冒烟验证 `scripts/harmony-smoke.ps1`，提交打包 `scripts/pack-c4-submission.ps1`，材料见 `docs/competition/C4-*`。

## 核心能力（近期迭代）

- **信任分门控伴学**：locked→hint→partial→explain 四级权限，低信任只引导不泄题
- **学生教练「看见屏幕」**：教练读取当前题干/阶段/草稿（`page_context`），点名具体内容引导
- **教师智能导入**：对话区挂文件即导入——意图分类（教案/练习/噪声）、花名册过滤、导入报告卡；名单 txt/csv 一键批量建号
- **学校-班级-课程-用户组织模型**：超管组织后台（/学校管理），数据按角色与班级严格隔离
- **多 Agent 闭环**：Teacher / Tutor / Evaluator / Reflector + 课程知识库检索（含引用试跑）

## 目录

```text
backend/              Go 教学服务层
teacher-web-next/     Web 前端（Next.js + React Bits；admin / teacher / student）
harmony/              鸿蒙入口（小艺技能 openapi + ArkTS 壳骨架）
scripts/              开发与部署脚本（含 harmony-smoke / pack-c4-submission）
docs/                 部署与申报文档（docs/competition/C4-* 为参赛材料）
dist-desktop/         单机 exe 打包产物
dist-c4/              C4 提交包产物（pack 脚本生成）
```

> 旧 Vite 前端 `teacher-web/` 与 uniapp 学生端已移除；统一使用 `teacher-web-next`。

## 单机桌面版（发给别人双击即用）

没有服务器时，可打成一个 Windows exe（内嵌前端 + SQLite，双击自动开浏览器）：

```powershell
.\scripts\build-desktop.ps1
```

产物在 `dist-desktop/`，详见 [docs/DESKTOP_PACKAGING.md](docs/DESKTOP_PACKAGING.md)。  
对方解压后双击 `StudyAI教学系统.exe`，浏览器访问 `http://127.0.0.1:18080`；LLM Key 可在管理员对话中输入 `/系统配置` 填写，或同目录 `.env`。

## 后端运行

```powershell
cd C:\Code\AI\Study\backend
go run .\cmd\edu-server
```

默认端口：`http://127.0.0.1:18080`

可选环境变量：

```powershell
$env:EDU_ADDR=':18080'
$env:EDU_DATA_DIR='data'
$env:EDU_ALLOWED_ORIGINS='http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001,http://127.0.0.1:18081'
$env:YUNQUE_BASE_URL='https://api.deepseek.com'
$env:YUNQUE_API_KEY='sk-你的密钥'
```

## 前端运行（Next / React Bits）

三端（admin / teacher / student）在同一 Next 应用里，按路由区分：

```powershell
cd C:\Code\AI\Study\backend
$env:EDU_ALLOWED_ORIGINS='http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001'
go run .\cmd\edu-server

# 另一个终端
cd C:\Code\AI\Study\teacher-web-next
npm install
npm run dev
```

默认地址：`http://localhost:3000`（被占用时可用 `-p 3001`）。

前端 API 地址通过 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 配置，默认 `http://127.0.0.1:18080`。  
桌面 exe 打包时使用 `same-origin`，走同源相对路径。

### 超管配置大模型

登录 admin 后，在对话输入框输入：

```text
/系统配置
```

填写 Base URL（如 `https://api.deepseek.com`）、模型（如 `deepseek-chat`）、API Key，勾选启用并保存。

## 冒烟测试

```powershell
cd C:\Code\AI\Study
.\scripts\smoke-test.ps1
```

## Docker

```powershell
cd C:\Code\AI\Study
docker compose up -d --build
```

- 后端：`http://127.0.0.1:18080`
- Web 前端：`http://127.0.0.1:18081`

## 默认账号

- 管理员：`admin / admin123456`
- 教师：`teacher / teacher123456`
- 学生：`student001 / student123456`

## 重置大学课程种子

```powershell
cd C:\Code\AI\Study
.\scripts\reset-university-seed.ps1
```

## 生产部署

详见 `docs/DEPLOYMENT.md`。

```powershell
cd C:\Code\AI\Study
Copy-Item .env.example .env
.\scripts\deploy-prod.ps1 -Mode prod
```

- 后端 API：`http://127.0.0.1:18080`
- Web 前端：`http://127.0.0.1:18081`

## PostgreSQL 迁移

当前推荐使用 SQLite 单文件数据库，详见 `docs/SQLITE_DEPLOYMENT.md`。PostgreSQL schema、compose 与导出工具保留为后续大规模 SaaS 迁移方案，详见 `docs/POSTGRES_MIGRATION.md`。

```powershell
cd C:\Code\AI\Study
docker compose -f docker-compose.postgres.yml up -d --build
.\scripts\export-json-to-postgres-sql.ps1
```

## SQLite 部署

```powershell
cd C:\Code\AI\Study\backend
$env:EDU_STORAGE_DRIVER='sqlite'
$env:EDU_SQLITE_PATH='C:\Code\AI\Study\backend\data\study.db'
.\bin\edu-server.exe
```

Docker 生产部署默认也使用 SQLite。详见 `docs/SQLITE_DEPLOYMENT.md`。
