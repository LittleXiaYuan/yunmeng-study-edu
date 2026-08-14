# 课程作业 · 4 份交付材料

> 课程：基于大模型 API 构建具有实际应用价值的 AI Agent
> 题目方向：教学辅助 / 代码审查 / 个性化学习
> 作品：云元 —— Self-Evolving Teaching System（沉浸式 AI 智能伴学系统）
> GitHub：<https://github.com/LittleXiaYuan/yunmeng-study-edu>
> 课程作业提交时间：2026-08

---

## 交付清单

| # | 材料 | 文件 | 页数 / 时长 | 状态 |
|---|------|------|------------|------|
| 1 | **《项目概况》** | [`01-项目概况.md`](./01-项目概况.md) | 7 节 / ~3,500 字 | ✅ 已交付 |
| 2 | **完整源代码** | 见根目录 + GitHub | 287 files / ~6,800 行 Go + 5,500 行 TS | ✅ 已交付 |
| 2a | 详细 README | [`../../README.md`](../../README.md) + [`../../CLAUDE.md`](../../CLAUDE.md) | — | ✅ |
| 2b | 环境部署说明 | [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) + [`../../docs/SQLITE_DEPLOYMENT.md`](../../docs/SQLITE_DEPLOYMENT.md) + [`../../docs/DESKTOP_PACKAGING.md`](../../docs/DESKTOP_PACKAGING.md) | — | ✅ |
| 2c | Git 仓库 URL | <https://github.com/LittleXiaYuan/yunmeng-study-edu> | — | ✅ |
| 3 | **《AI 协同日志》** | [`02-AI协同日志-白皮书9.1.md`](./02-AI协同日志-白皮书9.1.md) | 7 节 / ~6,000 字（白皮书 9.1 风格） | ✅ 已交付 |
| 4 | **《需求文档与系统架构》** | [`03-需求文档与系统架构.md`](./03-需求文档与系统架构.md) | 7 节 + ER + 架构图 + 37+ API（含 2 新增） | ✅ 已交付 |
| 5 | **《操作演示视频》** | [`04-演示视频脚本-10min.md`](./04-演示视频脚本-10min.md) | 10:00 脚本（待录制） | 🟡 脚本就绪 / 待录制 |

---

## 快速导航

- **看完整代码** → 根目录；GitHub: <https://github.com/LittleXiaYuan/yunmeng-study-edu>
- **跑起来** → `.\scripts\reset-university-seed.ps1` 后端 `go run .\cmd\edu-server` + 前端 `cd teacher-web-next && npm run dev` → `http://localhost:3000`
- **体验代码审查（本次亮点）** → 学生端底部 nav 「审查」图标 → 粘贴 SQL/Python → 审查
- **看技术架构图** → `docs/03-需求文档与系统架构.md` §4（含 5 Agent 详细架构 + CodeReview 流程图）
- **看 AI 怎么用** → `docs/02-AI协同日志-白皮书9.1.md`（按"工具-过程-产出-采纳-评估"五段式）
- **看视频怎么拍** → `docs/04-演示视频脚本-10min.md`（分镜表 + 旁白铁律 + 拍摄清单）

---

## 关键数字（供评审快速过）

| 指标 | 数值 |
|------|------|
| 后端代码量 | ~6,800 行 Go（5 Agent + 教学闭环 + 存储） |
| 前端代码量 | ~5,500 行 TS/TSX（3 端 + React Bits） |
| REST API 端点 | 37+（含 2 个新增 `/edu/code-review*`） |
| 单元测试 | 30+ 用例（access / retrieval / sqlite / **code_review**） |
| 学生参与工作量 | 75%（指导教师 15% + AI 10%） |
| 演示视频时长 | 10:00（脚本就绪，待录制） |
| 启动到登录 | < 1.5s（go run + sqlite in-memory） |
| CodeReview 响应 | < 200ms（启发式，LLM 关闭） |

---

## 本次作业的"加分项"

1. **真加 SQL/Python 代码审查 Agent**（5th Agent）—— 不是文档包装，是真功能
   - SQL 沙盒执行（`:memory:` SQLite + 事务 ROLLBACK）
   - Python 静态启发式（**不执行**，防沙箱逃逸）
   - 可扩展架构（`CodeReviewer` 接口 + 注册表）
   - 18 个新单元测试 + LLM 增强 + `sanitizeNoLeak` 守门

2. **完整工程化交付**
   - GitHub 开源 + 完整 commit log
   - 287 文件 / 58K 行（含 dist-c4、harmony/、scripts/）
   - Docker / Docker Compose / 单 exe 三种部署形态
   - 35+ REST 端点 + RBAC + 审计 + sanitize

3. **教学诚信边界**
   - 每个 AI Agent 都有"LLM + 本地启发式"双路径
   - LLM 不可用时系统不宕机
   - 所有 AI 生成代码**标注 + 人工 review + 测试**

---

## 课程作业 → 课堂答辩口径

- **作品名**：云元 —— Self-Evolving Teaching System
- **一句话**：在教学辅助、代码审查、个性化学习三大场景中，把"该不该帮、帮多深"做成可量化状态机的 AI 伴学 Agent
- **5 大 Agent**：Teacher（解析）/ Tutor（苏格拉底引导）/ Evaluator（评估）/ Reflector（班级反思）/ **CodeReview（代码审查）**
- **核心创新**：信任分门控（locked → hint → partial → explain）；学生教练「看见屏幕」；教师智能导入；SQL 沙盒 + Python 静态代码审查
- **GitHub**：<https://github.com/LittleXiaYuan/yunmeng-study-edu>
- **演示账号**：`admin/admin123456` / `teacher/teacher123456` / `student001/student123456`
