/**
 * 斜杠命令注册表 —— "对话为主"体验的能力发现层。
 *
 * 两类命令：
 *  - prompt 型：把一句预置的自然语言塞进输入框并发送，复用后端已识别的意图
 *    （create_class / publish_homework / class_report / knowledge_analysis / upload_materials）。
 *  - panel 型：直接打开右侧抽屉面板（学生名单 / 班级画像 / 学生详情 / 总览 …），
 *    由 ChatShell 的 openPanel 执行（见 Step 3 的 PanelDock）。
 *
 * 注册表是纯数据（无状态），放在 lib 下，供 ChatShell / SlashCommandMenu / 首屏胶囊共享。
 */

export type CommandGroup = "名单" | "教学" | "报告" | "资料" | "系统";
export type PortalMode = "admin" | "teacher";

export interface SlashCommand {
  id: string;
  /** 主触发词，展示为 /xxx */
  trigger: string;
  /** 额外的匹配词（中英文别名），用于模糊过滤 */
  aliases?: string[];
  label: string;
  description: string;
  group: CommandGroup;
  roles: PortalMode[];
  /** 是否进首屏技能胶囊 */
  featured?: boolean;
  /** panel 型：打开的面板 kind（交给 openPanel 处理） */
  panel?: string;
  /** prompt 型：预置的自然语言，填入输入框并发送 */
  prompt?: string;
}

/** 全部命令（含通用 + 两端专属），按注册顺序 */
const COMMANDS: SlashCommand[] = [
  // —— 通用 ——
  {
    id: "help",
    trigger: "help",
    aliases: ["帮助", "?", "指令", "能做什么"],
    label: "查看全部指令",
    description: "列出当前角色可用的所有能力",
    group: "系统",
    roles: ["admin", "teacher"],
    panel: "__help__",
  },
  {
    id: "overview",
    trigger: "总览",
    aliases: ["overview", "概览", "看板", "kpi"],
    label: "平台总览",
    description: "查看资料/任务/学生/检索的 KPI 看板",
    group: "系统",
    roles: ["admin", "teacher"],
    panel: "overview",
  },

  // —— 名单 ——
  {
    id: "org-admin",
    trigger: "学校管理",
    aliases: ["学校", "组织", "school", "org", "多租户"],
    label: "学校与组织",
    description: "新建/编辑/归档学校，按学校查看班级（仅超管）",
    group: "名单",
    roles: ["admin"],
    featured: true,
    panel: "org-admin",
  },
  {
    id: "students",
    trigger: "学生名单",
    aliases: ["students", "名单", "花名册", "学生列表", "roster"],
    label: "学生名单",
    description: "搜索 / 分页浏览学生，查看学情与信任分",
    group: "名单",
    roles: ["admin", "teacher"],
    featured: true,
    panel: "student-list",
  },
  {
    id: "import-students",
    trigger: "导入名单",
    aliases: ["import", "批量导入", "批量建号", "粘贴名单", "csv", "花名册"],
    label: "批量导入学生",
    description: "粘贴文本或 CSV，一次性批量创建学生账号",
    group: "名单",
    roles: ["admin", "teacher"],
    featured: true,
    panel: "student-import",
  },
  {
    id: "import-students-prompt",
    trigger: "一键导名单",
    aliases: ["导学生", "批量学生"],
    label: "对话导名单",
    description: "用自然语言发起名单导入，Agent 打开表单并指导操作",
    group: "名单",
    roles: ["admin", "teacher"],
    prompt: "帮我批量导入学生名单，打开导入面板。",
  },
  {
    id: "create-student",
    trigger: "新建学生",
    aliases: ["加学生", "add-student", "建号"],
    label: "新建学生",
    description: "创建单个学生账号",
    group: "名单",
    roles: ["admin", "teacher"],
    featured: true,
    prompt: "帮我新建一个学生账号。",
  },
  {
    id: "create-class",
    trigger: "新建班级",
    aliases: ["加班级", "add-class", "建班"],
    label: "新建班级",
    description: "创建一个班级",
    group: "名单",
    roles: ["admin"],
    featured: true,
    prompt: "帮我新建一个班级。",
  },
  {
    id: "create-course",
    trigger: "新建课程",
    aliases: ["加课程", "add-course", "建课"],
    label: "新建课程",
    description: "创建一门课程并关联班级",
    group: "名单",
    roles: ["admin"],
    prompt: "帮我新建一门课程。",
  },

  // —— 教学 ——
  {
    id: "lesson-analyze",
    trigger: "备课拆解",
    aliases: ["拆解", "知识点", "analyze", "备课"],
    label: "备课拆解",
    description: "拆解教案的核心知识点与常见难点",
    group: "教学",
    roles: ["teacher"],
    featured: true,
    prompt: "请帮我拆解这份教案的核心知识点和常见难点。",
  },
  {
    id: "publish-homework",
    trigger: "发作业",
    aliases: ["发布作业", "布置作业", "homework", "任务"],
    label: "发布作业",
    description: "生成并发布一个分步作业任务",
    group: "教学",
    roles: ["teacher"],
    featured: true,
    prompt: "请帮我发布一个新的分步作业任务。",
  },
  {
    id: "upload-materials",
    trigger: "传资料",
    aliases: ["资料注入", "上传教案", "upload", "导入资料"],
    label: "上传资料",
    description: "把教案 / 资料注入检索索引",
    group: "资料",
    roles: ["admin", "teacher"],
    featured: true,
    panel: "materials-upload",
  },
  {
    id: "upload-materials-prompt",
    trigger: "智能导资料",
    aliases: ["导教案", "知识库导入"],
    label: "对话导资料",
    description: "自然语言发起资料导入；可先在输入区挂文件",
    group: "资料",
    roles: ["admin", "teacher"],
    prompt: "我挂了教案文件，请帮我智能导入知识库。",
  },

  // —— 报告 / 画像 ——
  {
    id: "class-report",
    trigger: "班级报告",
    aliases: ["报告", "共性问题", "report", "教学建议"],
    label: "班级报告",
    description: "查看班级共性问题与教学建议",
    group: "报告",
    roles: ["teacher"],
    featured: true,
    prompt: "给我看一下班级的共性问题和教学建议报告。",
  },
  {
    id: "class-profile",
    trigger: "班级画像",
    aliases: ["画像", "学情", "profile", "班级情况"],
    label: "班级画像",
    description: "查看本班学情、均分与逐个学生的信任分",
    group: "报告",
    roles: ["teacher"],
    featured: true,
    panel: "class-profile",
  },

  // —— 系统 ——
  {
    id: "llm-config",
    trigger: "系统配置",
    aliases: ["配置", "llm", "模型配置", "settings"],
    label: "系统配置",
    description: "配置 LLM 网关（云雀）连接",
    group: "系统",
    roles: ["admin"],
    panel: "llm-config",
  },
];

/** 取某角色可用的命令 */
export function commandsFor(mode: PortalMode): SlashCommand[] {
  return COMMANDS.filter((c) => c.roles.includes(mode));
}

/** 取首屏技能胶囊（featured） */
export function featuredCommands(mode: PortalMode): SlashCommand[] {
  return commandsFor(mode).filter((c) => c.featured);
}

/** 按输入串模糊过滤（去掉开头的 /） */
export function filterCommands(mode: PortalMode, query: string): SlashCommand[] {
  const q = query.replace(/^\//, "").trim().toLowerCase();
  const list = commandsFor(mode);
  if (!q) return list;
  return list.filter((c) => {
    const hay = [c.trigger, c.label, c.description, ...(c.aliases ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** 整句是否在请求"帮助/能做什么"（自然语言兜底触发命令面板） */
export function isHelpPhrase(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "help" ||
    t === "帮助" ||
    t === "/help" ||
    t === "/帮助" ||
    t === "?" ||
    t === "？" ||
    /^(有哪些|你能做什么|能做什么|怎么用|使用帮助|所有指令|全部指令)/.test(t)
  );
}
