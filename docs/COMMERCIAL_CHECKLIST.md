# 商业级完成清单

## 已实现

- 独立 Go 教学服务层，不修改云雀源码
- `/edu/analyze`
- `/edu/chat`
- `/edu/evaluate`
- `/edu/report`
- `/edu/workflow`
- `/edu/dashboard`
- `/edu/classes`
- `/edu/students`
- `/edu/courses`
- `/edu/lessons`
- `/edu/lessons/upload`
- `/edu/homework`
- `/edu/homework/submit`
- `/edu/agent/write`
- 伪多 Agent Prompt 编排
- TutorAgent 不直接给答案，强制追问解释、反思、举例
- 分步作业：先解释、再举例、最后反思
- Trust Score 四级认知解锁
- JSON Memory 学生画像
- 平台状态 JSON：班级、学生、课程、教案、作业、提交记录、学习会话、审计日志
- 教师 Web 工作台：教案上传、AI 分析、学生列表、班级统计、教学建议、审计记录、Agent Chat、LLM 配置、分步作业
- uniapp 学生端：分步作业、对话、进度、报告
- 用户管理：管理员/教师/学生角色、登录 Token、用户创建与停用、受保护业务 API
- Dockerfile、docker-compose、生产 docker-compose、冒烟测试脚本、部署脚本
- 教师端与学生端生产 Nginx SPA 回退配置

## 当前适用等级

- 校内试点
- 课程交付
- 比赛展示
- 小规模 SaaS MVP
- 教学闭环验证

## 生产化下一步

- PDF/PPT/DOCX 二进制解析接入
- 云雀真实 `/v1` 协议字段精确适配
- JWT 标准化、学校租户隔离、细粒度 RBAC 权限矩阵
- SQLite 单文件数据库已接入；PostgreSQL schema / compose / JSON 导出 SQL 作为后续迁移方案保留
- Redis 队列与异步解析任务
- 教师批量导入学生
- 班级维度长期趋势图
- 学生端小程序/App 真机打包
- CI/CD 与灰度发布
- 数据脱敏、审计导出、合规留存策略


