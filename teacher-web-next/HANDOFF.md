# 项目交接 · teacher-web-next

> 一份给接手人（或未来的自己）的交接说明。读完这份就能上手。
> 交接日期：2026-07-08。

---

## 1. 这是什么

`teacher-web-next` 是「云雀教学 Agent」的**新前端**，用 **Next.js 16 + React 19 + Tailwind v4** 写的。

这是项目的 **唯一** Web 前端：登录 + admin/teacher/student 三端，对接 Go 后端（默认 `http://127.0.0.1:18080`）。旧 Vite / uniapp 前端已删除。

---

## 2. 怎么跑起来（3 步）

**第 1 步 · 起后端**（一个终端，保持开着）
```powershell
cd C:\Code\AI\Study\backend
$env:EDU_ALLOWED_ORIGINS="http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001"
go run .\cmd\edu-server
```
看到 `edu server listening on :18080` 即成功。
> ⚠️ 那行 `EDU_ALLOWED_ORIGINS` 不能省 —— 少了前端端口，浏览器登录会被 CORS 拦。

**第 2 步 · 起前端**（另一个终端）
```powershell
cd C:\Code\AI\Study\teacher-web-next
npm install
npm run dev
```
看到 `Local: http://localhost:3000`（被占用会自动用 3001）即成功。

**第 3 步 · 打开浏览器**，用下面账号登录。

### 测试账号
| 角色 | 账号 | 密码 | 登录后进入 |
|---|---|---|---|
| 管理员 | `admin` | `admin123456` | `/admin` |
| 教师 | `teacher` | `teacher123456` | `/teacher` |
| 学生 | `student001` | `student123456` | `/student` |

---

## 3. 代码在哪（找东西看这里）

```
app/
  page.tsx                首页（shader 落地页 + 三端入口）
  login/page.tsx          登录页
  admin/ teacher/ student/  三端，每个目录里：
    layout.tsx            角色门禁（RoleGuard 包裹）
    page.tsx              该端入口

components/
  session-provider.tsx    ★ 核心：全局状态 + 所有后端请求都在这里
  portal/
    role-guard.tsx        角色门禁（登录校验 + 走错端拦截）
    login-screen.tsx      登录界面
    admin-portal.tsx      超管端外壳
    teacher-portal.tsx    教师端外壳
    student-portal.tsx    学生端（移动布局 + 作业分步 + 撒花）
    views.tsx             admin/teacher 共用的视图（总览/资料/人员/Agent对话）
    ui.tsx                共用 UI 组件（侧栏、KPI 卡、表格等）
  shader-canvas.tsx       流体 WebGL 背景（模板自带，勿删）

lib/
  api.ts                  ★ 后端接口封装（登录/看板/上传/对话/作业…）
  types.ts                数据类型
  portal-helpers.ts       纯函数工具
```

**两个最关键的文件**：
- `components/session-provider.tsx` —— 想改「状态/请求逻辑」看这里（相当于旧版 `main.tsx` 的 App）。
- `lib/api.ts` —— 想改「调哪个后端接口」看这里。

---

## 4. 对接的后端接口（共 8 个）

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/auth/login` | 登录 |
| GET | `/auth/me` | 取当前用户 |
| GET | `/edu/dashboard` | 看板全量数据 |
| GET / POST | `/edu/llm/config` | 读/存 LLM 配置 |
| POST | `/edu/lessons/upload` | 上传教案（multipart） |
| POST | `/edu/classes` `/edu/courses` `/edu/students` | 建班/课/学生 |
| POST | `/edu/chat` | Agent 对话 |
| POST | `/edu/homework/submit` | 学生提交分步作业 |

规律：**每次写操作后，会整体重新拉一次 dashboard**（没有局部更新，逻辑简单）。

---

## 5. 和旧版 teacher-web 的关键差异

| 旧版 | 新版 |
|---|---|
| 假路由（`pushState`）+ 一个大 `App()` 闭包 | 真路由 `/admin` `/teacher` `/student` + `SessionProvider` |
| 2195 行手写 CSS | Tailwind + 模板 design token（支持明暗主题） |
| 环境变量 `VITE_API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL`（在 `.env.local`） |

已验证可交付：`npm run build` 通过、三端真实登录端到端无报错。

---

## 6. React Bits 组件库 —— 已集成 ✅

项目已配好 shadcn（`components.json` + `.env.local`），并用**全权限 key** 装了真正的 React Bits 组件。

**已安装并接线的组件**（在 `components/` 根目录，均为 `-tw` Tailwind 版）：
| 组件 | 用在哪 | 文件 |
|---|---|---|
| `silk-waves` | 登录页流体背景（深蓝专业配色） | `components/silk-waves.tsx` |
| `staggered-text` | 学生端 hero 标题逐字入场动画 | `components/staggered-text.tsx` |
| `shader-card` | 教师/超管概览页顶部欢迎横幅 | `components/shader-card.tsx` |

接线位置：`components/portal/login-screen.tsx`、`student-portal.tsx`、`views.tsx`。
均用 `dynamic(() => import(...), { ssr: false })` 懒加载（WebGL 组件的 skill 最佳实践）。

### 再装更多组件
```powershell
# .env.local 里的 REACTBITS_LICENSE_KEY 已是全权限 key
npx shadcn@latest add @reactbits-starter/<组件>-tw     # 组件（101 个，见 skill 目录）
npx shadcn@latest add @reactbits-pro/<block>           # block（158 个，如 hero-3/pricing-2）
```
- **组件**默认导出：`import X from "@/components/<slug>"`。
- **block** 导出风格不一，装完先 `grep "^export" components/<slug>.tsx` 再决定具名/默认导入。
- WebGL/shader 组件必须放在**有明确尺寸的父容器**里，并 `ssr:false` 懒加载。
- 完整目录和规范见全局 skill：`react-bits-pro`（`C:\Users\Administrator\.claude\skills\react-bits-pro\SKILL.md`）。

### 关于 key 与代理站（注意）
- registry 走代理站 `registry.collectui.vip`（配在 `components.json`）。
- ⚠️ 该代理站首页曾显示「被 Google 安全浏览标记 + 可疑迁移引导」。**勿在该站或其引导域名输入支付信息**；正规购买走官方 `pro.reactbits.dev`。
- key 存在 `.env.local`（已被 `.gitignore` 忽略），**不要提交**。

### tsconfig 调整（重要）
为兼容 React Bits 组件源码，已在 `tsconfig.json` 关掉两个过严开关：`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`（`strict: true` 主体保留）。装 React Bits shader 组件还需 `@types/three`（已装）。

---

## 7. 更多细节

完整的迁移记录、验证证据、复现命令见 `../docs/FRONTEND_MIGRATION.md`。
