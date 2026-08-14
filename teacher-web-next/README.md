# teacher-web-next

云雀教学 Agent 的 **唯一** Web 前端。Next.js 16 + React 19 + Tailwind v4 + React Bits 视觉；登录与三端（admin / teacher / student）一体对接 Go 后端。

## 运行

先启动后端（Go 服务，默认 `:18080`）：

```powershell
cd ..\backend
$env:EDU_ALLOWED_ORIGINS = "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001"
go run .\cmd\edu-server
```

再启动前端：

```powershell
cd teacher-web-next
npm install
npm run dev        # http://localhost:3000（被占用时自动用 3001）
```

后端地址通过 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 配置，默认 `http://127.0.0.1:18080`。

> 后端 CORS 白名单 `EDU_ALLOWED_ORIGINS` 必须包含前端实际端口，否则登录会被浏览器 CORS 拦截。

## 默认账号

- 管理员：`admin / admin123456` → `/admin`
- 教师：`teacher / teacher123456` → `/teacher`
- 学生：`student001 / student123456` → `/student`

## 结构

```
app/
  page.tsx                首页（shader 落地页 + 入口）
  login/                  登录页（shader 背景 + 角色切换）
  admin|teacher|student/  三端路由段（layout 内 RoleGuard 角色门禁）
components/
  session-provider.tsx    全局 Session Context（状态 + 所有 API 动作，替代旧 App 巨闭包）
  portal/                 三端外壳与视图（Tailwind 重做）、登录屏、角色门禁
  shader-canvas.tsx       ogl 流体 WebGL 背景（模板保留）
  nav / theme-switch / shader-variant-toggle   模板 chrome
lib/
  api.ts                  后端 8 接口封装（apiFetch + login/dashboard/upload/chat/homework…）
  types.ts                领域类型（自旧 teacher-web 搬运）
  portal-helpers.ts       纯函数 helper
```

## React Bits 组件（可选）

项目已配好 shadcn + `components.json`（registry 指向 `registry.collectui.vip` 代理站）。拿到有权限的 license key 后，写入 `.env.local` 的 `REACTBITS_LICENSE_KEY`，即可：

```powershell
npx shadcn@latest add @reactbits-starter/<组件>-tw
```

当前试用 key 仅可安装公开的 `globe-tw`；其余组件与 pro block 需付费 / 全权限 key。
