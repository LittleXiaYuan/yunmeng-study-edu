# 云雀教学 · UX / UI 规范

依据 **React Bits Pro Skill** + 教学产品约束整理。实现代码与组件安装均按此文档执行。

---

## 1. 产品气质（一句话）

**「书房里的教练」** — 冷静、可信、少打断。  
**教师端 = Agent 工作台**；**学生端 = 沉浸式伴学**（不是缩小版管理台）。  
动效服务专注，不服务炫技。

| 端 | 产品形态 | 主任务 | 视觉重心 |
|----|----------|--------|----------|
| 学生 | 沉浸式伴学 | 分步答题 + 信任门控辅导 | 当前步骤放大；练习时收起导航 |
| 教师 | Agent 工作台 | 发任务、看班级、改草稿、Agent 草稿 | 表单/列表优先，Agent 悬浮 |
| 超管 | 运维台 | 配置与总览 | 清晰 Dashboard，LLM 配置可折叠 |

### 学生端 · 沉浸式伴学（硬规则）

1. **默认进练习** — 有可练任务时首屏进专注台；无任务才落「今日」  
2. **壳层始终同一套** — 顶栏药丸导航 + 移动底栏在练习中也保留；只换中间内容，不换「另一个 App」  
3. **教练在流内** — `CoachSheet` 叠在答题台上，不强制跳「问 AI」全页；全页 Ask 仅作复盘/扩展  
4. **只引导不代答** — 文案与 Tutor 一致：陪你想清楚，不直接给答案  
5. **今日 = 续练枢纽** — 一个主 CTA + 最多 3 条「接下来」；课程是过滤器，不是第二导航  
6. **底栏 ≤ 4** — 练习 / 今日 / 任务 / 我的（教练不占底栏）

### UX 硬规则（frontend-design / ui-ux-pro-max）

1. **每屏一个主 CTA** — 禁止与底栏/侧栏重复的「快捷入口宫格」  
2. **空状态要可行动** — 说明原因 + 下一步  
3. **少 KPI 墙** — 总览最多 2 个指标 + 一张近期列表  
4. **一页最多一个签名动效**  
5. **教师表单用抽屉** — 不把 CRUD 铺成满页 CMS

---

## 2. React Bits 安装与使用（Skill 硬规则）

### 2.1 安装

```powershell
cd teacher-web-next
$env:REACTBITS_LICENSE_KEY = (Get-Content .env.local | Where-Object { $_ -match 'REACTBITS_LICENSE_KEY' })
# 注意：当前环境请用 4.13（4.14 可能 Unknown registry）
npx shadcn@4.13.0 add @reactbits-starter/<slug>-tw --yes
npx shadcn@4.13.0 add @reactbits-pro/<slug> --yes
```

- 组件 **必须** `-tw` 或 `-css`；本项目只用 **`-tw`**。
- 区块 **无后缀**（如 `hero-1`）。
- License 只写在 `.env.local`，禁止硬编码进源码。

### 2.2 导入

| 类型 | 规则 |
|------|------|
| Starter 组件 | **始终 default import**，路径以安装后文件为准 |
| Pro 区块 | 先 `grep`/`read` 文件的 `export` 行，再决定 named / default |
| 禁止 | 猜 export 名；删 `"use client"`；把 WebGL 组件塞进无宽高的父级 |

### 2.3 运行时

```tsx
// WebGL / 重动画：懒加载 + 关 SSR + 父级定尺寸
const SilkWaves = dynamic(() => import("@/components/silk-waves"), { ssr: false });

<div className="absolute inset-0 h-full w-full">
  <SilkWaves className="absolute inset-0" ... />
</div>
```

- 动画库统一：`motion/react`（不要 `framer-motion`）。
- `prefers-reduced-motion: reduce` 时关闭装饰动画（见 `globals.css`）。

### 2.4 何时用 React Bits / 何时不用

| 场景 | 用 | 不用 |
|------|----|------|
| 登录/营销氛围 | Silk Waves、Shader 背景 | 业务表单里塞 WebGL |
| 学习完成庆祝 | Confetti / 轻量粒子 | 答题过程中全屏粒子 |
| 列表/步骤 | Motion 布局 / BlurHighlight 强调题干 | 每张卡片都挂 3D |
| 管理表格、表单 | 原生 + 设计令牌 | 重动画背景 |

**原则：一页最多一个「签名动效」。**

---

## 3. 设计令牌

实现位置：`app/globals.css`。类名与 CSS 变量对照：

| Token | 用途 | 使用方式 |
|-------|------|----------|
| `--background` / `--foreground` | 页面底 / 主文字 | `bg-background` `text-foreground` |
| `--card` | 卡片面 | `bg-card` |
| `--muted` / `--muted-foreground` | 次要面 / 说明文字 | `bg-muted` `text-muted-foreground` |
| `--border` | 分割线、描边 | `border-border` |
| `--brand` / `--brand-foreground` | 品牌主色（靛蓝） | `bg-brand` `text-brand` |
| `--brand-soft` | 品牌浅底 | `bg-brand-soft` |
| `--success` | 已通过 / 正向 | `text-success` |
| `--trust` | 信任分强调 | `text-trust` |
| `--danger` | 错误 | `text-danger` |
| `--radius-card` | 大卡片圆角 | `rounded-[var(--radius-card)]` |
| `--shadow-stage` | 焦点步骤卡投影 | `shadow-[var(--shadow-stage)]` |
| `--stage-blur` | 非焦点模糊强度 | 见学习流 |

**禁止**在门户业务里随意写死 `#6366f1` 等；优先 token。营销登录页可用固定深色板（与 Silk 配色一致）。

### 3.1 字体

- 界面：`Geist`（`--font-sans`）
- 数据/等宽：`Geist Mono`
- 字号阶梯：11 / 12 / 13 / 14 / 16 / 20 / 24 / 28  
  标题 `tracking-tight`，眉标 `uppercase tracking-[0.14em~0.18em] text-[11px]`

### 3.2 间距

- 页面水平：`px-4 sm:px-6`（学生）/ `px-6 sm:px-8`（管理）
- 卡片内边距：`p-4` 小 · `p-5~p-6` 中 · `p-6 sm:p-8` 焦点步骤
- 区块间距：`gap-3` / `gap-4` / `space-y-3`

### 3.3 圆角与控件

| 元素 | 圆角 |
|------|------|
| 按钮（主） | `rounded-lg` 或 `rounded-full`（学生 CTA） |
| 输入 | `rounded-xl` / Composer `rounded-2xl` |
| 卡片 | `rounded-2xl` |
| 焦点步骤卡 | `rounded-[1.75rem]` ≈ `--radius-card` |
| 图标底 | `rounded-lg` / `rounded-xl` |

---

## 4. UX 交互规范

### 4.1 学生端「专注学习流」（主路径）

1. **默认进「学习」**，不是堆满「今日」卡片。
2. **同时只清晰展示当前步骤**；其它步骤缩小 / 降对比 / 可选虚化。
3. **题目卡 vs 说明 vs 教练反馈 三层分离**，禁止文字叠在题干上。
4. **输入条固定底部**，实底 + 轻 blur，不透明压字。
5. 信任分与引导问题在反馈区展示；Tutor **只提问不直接给答案**（产品层，UI 勿写「标准答案」按钮）。
6. 完成用短庆祝（confetti 一次），然后引导画像 / 下一任务。

### 4.2 教师 / 超管

1. **工作台优先**：侧栏导航 + 主区表单/表格；Agent **右下悬浮**，不占满主路由。
2. 布置作业：**结构化表单**（步骤列表可增删），禁止「整页只有一个聊天框发作业」。
3. LLM 配置：折叠面板 / 斜杠命令（如 `/系统配置`），不作为日常主页。

### 4.3 引导（Onboarding）

- 可关闭，key：`study-onboard:*`
- 不挡学习流主舞台；从「今日」或顶栏「引导」进入
- 三步：确认课程 → 看任务 → 进入练习

### 4.4 滚动

- 学生壳：`position: fixed` 视口 + **唯一** `#student-scroll-root` 滚动
- 门户页 **关闭 Lenis**（`features.smoothScroll` 仅营销首页）
- 禁止在可滚主区外包一层会吞 `wheel` 的 `transform` 动画容器（步骤切换动画只包卡片）

### 4.5 可访问与稳健

- 关键按钮有 `aria-label` / `aria-current="step"`
- 错误：`role="alert"` + 可行动文案
- 空状态：说明「没有什么」+ **下一步做什么**
- 加载：按钮内 spinner，不整页白屏

---

## 5. 组件分层

```
components/
  silk-waves.tsx, blur-highlight.tsx, ...   # React Bits 安装产物（可改源码）
  magicui/                                  # 轻量计数等
  portal/
    ui.tsx          # PortalShell 管理壳
    page-kit.tsx    # PageIntro / EmptyState / QuickAction
    student-bits.tsx# Composer / 气泡
    learning-flow.tsx  # 专注学习（签名交互）
    *-portal.tsx    # 各角色入口
  portal-chrome.tsx # 仅营销首页主题钮
```

新增 UI：

1. 能用 token + `page-kit` / `ui` 就不要新造一套灰阶。
2. 需要动画 → 先查 Skill 附录是否有 Starter 组件；没有再用 `motion` 手写。
3. 落地页整块 section 才考虑 `@reactbits-pro/*` block。

---

## 6. 文案语气

- 中文、短句、动作明确：「继续答题」「回到当前阶段」
- 不用内部术语：「Workflow」「AgentClient」
- 信任分：展示数字即可，不说「算法」
- 错误不道歉堆砌，只说原因 + 怎么修

---

## 7. 验收清单（改 UI 后自检）

- [ ] 学生在 `http://localhost:3001/student`（非 18080 旧包）看到专注步骤流
- [ ] 当前步骤明显更大；说明与反馈不压题
- [ ] 画像/长列表可在主区内滚动
- [ ] 登录页 WebGL 有明确宽高父级，无 SSR 报错
- [ ] `prefers-reduced-motion` 下无长动画
- [ ] 新装 React Bits 组件：default import + 未删 use client
- [ ] 无 license 明文进 git

---

## 8. 相关路径

| 文件 | 作用 |
|------|------|
| `components.json` | registries（starter/pro） |
| `.env.local` | `REACTBITS_LICENSE_KEY` |
| `.agents/skills/react-bits-pro/SKILL.md` | 安装/导入/目录全文 |
| `app/globals.css` | 设计令牌 |
| `components/portal/learning-flow.tsx` | 学生签名体验 |
