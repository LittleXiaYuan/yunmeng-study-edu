# 单机桌面版打包说明

在没有公网服务器时，可以把本系统打成 **一个 Windows exe**：对方双击即可在浏览器里使用管理端 / 教师端 / 学生端。

## 一键打包（开发者）

在仓库根目录执行：

```powershell
.\scripts\build-desktop.ps1
```

产物在 `dist-desktop/`：

| 文件 | 说明 |
|------|------|
| `StudyAI教学系统.exe` | 双击启动 |
| `.env.example` | 可选环境变量模板（复制为 `.env`） |
| `使用说明.txt` | 给最终用户的中文说明 |

仅重编后端（前端未改）时：

```powershell
.\scripts\build-desktop.ps1 -SkipFrontend
```

## 原理

1. `teacher-web-next` 以 `output: "export"` + `NEXT_PUBLIC_API_BASE_URL=""` 构建 → 静态站点 + 同源相对路径 API  
2. Next 产物 `out/` 复制到 `backend/cmd/edu-server/web/`  
3. Go 用 `//go:embed` 把前端打进二进制  
4. 进程启动后监听 `:18080`，同时提供 API + 静态页面，并尝试自动打开浏览器  
5. 数据默认写在 **exe 同目录 `data/`**（SQLite）

> 仓库仅保留 `teacher-web-next` 作为唯一前端。

## LLM Key 怎么解决（无服务器）

大模型不必部署在你这边的服务器上。三种常见方式：

### 1. 网页里配置（推荐给最终用户）

管理员登录 → **设置** → 填：

- Base URL（OpenAI 兼容）
- Model
- API Key
- 勾选启用

配置会保存在本地 `data/study.db`，重启仍有效。

### 2. 同目录 `.env` 文件

把 `.env.example` 复制为 `.env`，例如 DeepSeek：

```env
YUNQUE_BASE_URL=https://api.deepseek.com
YUNQUE_API_KEY=sk-xxxx
```

### 3. 完全本机模型（Ollama 等）

本机安装 Ollama 并拉模型后：

```env
YUNQUE_BASE_URL=http://127.0.0.1:11434
YUNQUE_API_KEY=
```

在管理端模型名填实际模型（如 `qwen2.5:7b`）。  
注意：当前客户端请求路径为 `{base}/v1/chat/completions`，需使用提供 OpenAI 兼容层的服务。

### 不配 Key 时

系统仍可登录、看演示数据；教学 Agent 会走 **启发式降级**，不依赖外网。

## 发给别人

```text
把 dist-desktop 整个文件夹压缩成 zip
  → 对方解压到任意路径
  → 双击 StudyAI教学系统.exe
  → 浏览器打开 http://127.0.0.1:18080
```

对方 **不需要** 安装 Go、Node、Docker。

## 与 Docker / 服务器部署的关系

| 方式 | 适用 |
|------|------|
| 本桌面 exe | 演示、比赛、单机试用、暂无服务器 |
| `docker compose` | 固定机器上长期跑、多端访问 |
| 云服务器 | 公网访问、多校部署 |

桌面版与服务器版共用同一套后端业务逻辑；桌面版额外做了「内嵌前端 + 便携数据目录」。

## 开发注意

- `backend/cmd/edu-server/web/` 在未打包时有占位 `index.html`；完整构建会被 `teacher-web-next/out` 覆盖。  
- 日常开发：`go run .\cmd\edu-server` + `cd teacher-web-next; npm run dev`（默认 `http://localhost:3000`，API 连 `http://127.0.0.1:18080`；CORS 需含前端端口）。  
- 默认存储驱动为 **sqlite**（与桌面发行一致）；可用 `EDU_STORAGE_DRIVER=json` 切回 JSON。
