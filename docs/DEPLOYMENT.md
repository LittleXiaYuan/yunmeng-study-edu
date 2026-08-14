# Study AI 教学系统部署手册

## 1. 当前交付形态

本项目是独立 SaaS 化教学系统，不修改云雀项目源码。

- 后端：Go，教学服务层与 Agent 编排，默认端口 `18080`
- Web 前端：Next.js + React Bits（admin / teacher / student 一体），生产容器端口 `18081`
- 数据：当前推荐 SQLite 单文件数据库，Docker volume 持久化
- Agent：OpenAI 兼容 `/v1`（云雀 / DeepSeek 等），也支持无 LLM 时的规则兜底

## 2. 一键本机生产部署

```powershell
cd C:\Code\AI\Study
Copy-Item .env.example .env
notepad .env
.\scripts\deploy-prod.ps1 -Mode prod
```

访问：

```text
后端 API：http://127.0.0.1:18080
Web 前端：http://127.0.0.1:18081
```

默认账号：

```text
管理员：admin / admin123456
教师：teacher / teacher123456
学生：student001 / student123456
```

超管配置大模型：登录后输入 `/系统配置`。

## 3. 只构建不启动

```powershell
cd C:\Code\AI\Study
.\scripts\deploy-prod.ps1 -BuildOnly
```

等价验证：

```powershell
cd C:\Code\AI\Study\backend
go test ./...
go build -o bin\edu-server.exe .\cmd\edu-server

cd C:\Code\AI\Study\teacher-web-next
npm run build
```

## 4. Docker Compose 生产部署

```powershell
cd C:\Code\AI\Study
Copy-Item .env.example .env
# 修改 .env 后执行
docker compose -f docker-compose.prod.yml up -d --build
```

查看日志：

```powershell
docker compose -f docker-compose.prod.yml logs -f edu-backend
docker compose -f docker-compose.prod.yml logs -f web
```

停止：

```powershell
docker compose -f docker-compose.prod.yml down
```

## 5. 服务器域名部署

推荐域名：

```text
https://api.example.com   后端
https://app.example.com   Web 前端（三端同域，按路由 /admin /teacher /student）
```

`.env` 示例：

```env
PUBLIC_API_BASE_URL=https://api.example.com
BACKEND_PORT=18080
WEB_PORT=18081
EDU_ALLOWED_ORIGINS=https://app.example.com
YUNQUE_BASE_URL=https://api.deepseek.com
YUNQUE_API_KEY=sk-your-key
```

## 6. Nginx 反向代理模板

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:18080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:18081;
    proxy_set_header Host $host;
  }
}
```

HTTPS 可用 acme.sh / certbot 追加证书。

## 7. 大模型接入

系统启动时读取：

```env
YUNQUE_BASE_URL=https://api.deepseek.com
YUNQUE_API_KEY=sk-your-key
```

也可在超管对话中输入 `/系统配置`，填写 base_url / model / api_key 并启用。  
Base URL **不要** 带末尾 `/v1`（程序会请求 `{base}/v1/chat/completions`）。

DeepSeek 示例：

| 字段 | 值 |
|------|-----|
| base_url | `https://api.deepseek.com` |
| model | `deepseek-chat` |
| api_key | `sk-...` |
