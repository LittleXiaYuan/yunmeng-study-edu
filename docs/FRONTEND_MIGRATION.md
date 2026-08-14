# 前端迁移记录：teacher-web → teacher-web-next

> 记录一次前端整站迁移（Vite/React18 → Next.js 16/React19），以及围绕 React Bits 组件库的排查结论。
> 完成日期：2026-07-08。

## 一、起因

目标是用 **React Bits Pro**（shadcn 生态的付费动画组件库）优化前端三端 UI（登录页、admin / teacher / student）。

排查中发现试用 key 权限受限（见第四节），改为使用用户合法拥有的 **React Bits Shader Template**（`shader-template.zip`，Ultimate 档模板：Next.js 16 + React 19 + Tailwind v4 + ogl 流体 WebGL 背景）作为新前端骨架，**整站迁移**旧 `teacher-web`。

## 二、产出：`teacher-web-next/`

一个全新的 Next.js App Router 前端，与旧 `teacher-web/` 并存，后端 Go 服务（`:18080`）不变。

- **技术栈**：Next.js 16.1.1 + React 19 + Tailwind v4 + Turbopack。
- **视觉**：模板的 ogl 流体 shader 背景（登录页 / 首页）、明暗主题、shader 配色切换 —— 均为模板自带资源，**未使用任何付费 key**。
- **三端 UI**：全部用模板 Tailwind token 重做，功能等价于旧三端。

### 迁移映射

| 旧（teacher-web / Vite） | 新（teacher-web-next / Next.js） |
|---|---|
| `main.tsx` 里的 `App()` 巨闭包（全部状态 + handler） | `components/session-provider.tsx`（Session Context） |
| 闭包内 `apiFetch` + 内联请求 | `lib/api.ts`（8 个后端接口封装） |
| `types.ts` | `lib/types.ts`（原样搬运） |
| `pushState` 假路由 + `portalRoute` | 真实路由 `/admin` `/teacher` `/student` + `RoleGuard` 门禁 |
| `AdminPortal/TeacherPortal/StudentPortal.tsx`（自定义 CSS） | `components/portal/*`（Tailwind 重做） |
| `VITE_API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` |
| 2195 行手写 `styles.css` | 模板 `app/globals.css` design token + Tailwind |

### 对接的后端接口（8 个）
`POST /auth/login`、`GET /auth/me`、`GET /edu/dashboard`、`GET|POST /edu/llm/config`、`POST /edu/lessons/upload`（multipart）、`POST /edu/classes`、`POST /edu/courses`、`POST /edu/students`、`POST /edu/chat`、`POST /edu/homework/submit`。

## 三、验证结果（全部通过）

- `npm run typecheck` ✓（模板 tsconfig 严格：`noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`）
- `npm run build` ✓（11 个页面静态生成）
- 后端 API 契约 curl 实测：三角色登录 / dashboard / llm-config 均正确 ✓
- Playwright 真实浏览器端到端：三角色登录 → 角色跳转 → 三端加载真实数据，**零 console 错误** ✓
- 截图确认：登录页 shader 背景、Admin KPI（教案 12 / 任务 6 / 学生 2 / 索引 12）、Student 分阶段任务 + 信任分 72 + 撒花 ✓

### 运行方式
```powershell
# 后端（CORS 必须含前端端口）
cd backend
$env:EDU_ALLOWED_ORIGINS="http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001"
go run .\cmd\edu-server

# 前端
cd teacher-web-next
npm install
npm run dev   # http://localhost:3000（占用时自动 3001）
```
账号：`admin/admin123456`、`teacher/teacher123456`、`student001/student123456`。

## 四、React Bits 组件库：排查结论（未落地，卡在第三方 registry）

**目标**：`npx shadcn@latest add @reactbits-starter/<组件>` 装官方组件。
**现状**：未能装成除 `globe-tw` 外的任何组件。原因**不在客户端配置**（配置正确、CLI 链路已通），而在第三方代理站 `registry.collectui.vip` 的授权。

实测（官方 shadcn CLI + curl 反复验证）：

| 请求 | 结果 |
|---|---|
| 不带 key | `401 Credentials required` |
| 试用 key `try_reactbits_public_2026` + `globe-tw` | **200 ✓** |
| 试用 key + 其它 starter 组件 / 所有 pro block | `401 Access denied — Public trial credentials can only access public components. Use a paid key.` |
| 文档示例 `FAKE-0000...` key（官方地址） | `License key not found` |

**复现命令**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer try_reactbits_public_2026" \
  "https://registry.collectui.vip/api/r/reactbits/starter/silk-waves-tw.json"   # → 401
```

### ⚠️ 安全提醒
- `registry.collectui.vip` 首页显示 **"此域名已被 Google 安全浏览标记"**，并引导"一键迁移到新域名 / 凭据自动同步"，带钓鱼特征。
- **不要在该站或其引导的新域名输入真实付费凭据 / 支付信息。**
- React Bits 官方站为 `pro.reactbits.dev`；如需正规 key 应走官方，勿用被标记的第三方代理。

### 后续如何真正用上 React Bits（三选一）
1. **官方购买**：在 `pro.reactbits.dev` 购 license（`rbps-`/`rbpp-`/`rbpu-`）→ 把 `components.json` registry 换成官方地址 → `shadcn add` 全套。
2. **手写同源组件**：模板已含真 React Bits 出品的 `ShaderCanvas` / `WaveShader`（ogl WebGL）。按其写法补更多背景 / 文字动画，0 成本、不依赖 key。
3. **暂缓**：现有 `teacher-web-next` 已是完整可跑系统；`components.json` 已配好，拿到有效 key 后随时叠加。

## 五、目录现状

- `teacher-web-next/` —— 新前端（完成、可跑、已 build 通过）。
- `teacher-web/` —— **已删除**（2026-07-23）；仓库仅保留 `teacher-web-next/` 作为唯一前端。
- `shader-template.zip` —— 原始模板（保留，用户合法资产）。
- `teacher-web-next/components.json` + `.env.local` —— shadcn + registry 配置（registry 指向代理站，待有效 key）。
