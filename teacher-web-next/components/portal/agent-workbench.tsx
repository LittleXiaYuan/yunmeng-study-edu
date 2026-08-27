"use client";

import { Mic, MicOff, Paperclip, Send, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { currentCourse, formatBytes } from "@/lib/portal-helpers";
import type {
  AgentChoice,
  AgentDirective,
  AgentTurn,
  ConversationMessage,
  ConversationSummary,
} from "@/lib/types";
import {
  featuredCommands,
  filterCommands,
  isHelpPhrase,
  type SlashCommand,
} from "@/lib/commands";
import { DirectiveBubble } from "./directive-renderer";
import { SlashCommandMenu } from "./slash-command-menu";
import { hasPanel } from "./panel-registry";

const AIBlob = dynamic(() => import("@/components/ai-blob"), { ssr: false });

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type WorkbenchEntry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; directive: AgentDirective; dismissed?: boolean };

function extractSpeechText(event: unknown): string {
  const results = (event as { results?: ArrayLike<ArrayLike<{ transcript: string }>> })
    .results;
  if (!results) return "";
  let text = "";
  for (let i = 0; i < results.length; i++) {
    text += results[i]?.[0]?.transcript ?? "";
  }
  return text;
}

/** WorkbenchEntry[] → 可持久化的 ConversationMessage[]（agent 存整个 directive）。 */
function entriesToMessages(entries: WorkbenchEntry[]): ConversationMessage[] {
  return entries.map((e) =>
    e.role === "user"
      ? { role: "user", text: e.text }
      : { role: "agent", directive: e.directive },
  );
}

/** ConversationMessage[] → WorkbenchEntry[]（重建对话气泡）。 */
function messagesToEntries(messages: ConversationMessage[]): WorkbenchEntry[] {
  return messages.map((m, i) =>
    m.role === "user"
      ? { id: `u-load-${i}`, role: "user" as const, text: m.text ?? "" }
      : {
          id: `a-load-${i}`,
          role: "agent" as const,
          directive: m.directive ?? {
            reply: m.text ?? "",
            intent: "chat",
            llm_status: "ok",
          },
        },
  );
}

/** 由首条用户消息生成会话标题（截断）。 */
function deriveTitle(entries: WorkbenchEntry[]): string {
  const firstUser = entries.find((e) => e.role === "user");
  const text = firstUser && firstUser.role === "user" ? firstUser.text : "";
  const trimmed = text.trim().slice(0, 20);
  return trimmed || "未命名对话";
}

/**
 * 从 directive 的 card.fields 与 choice.payload 里容错取值。
 * LLM 生成的 directive key 不稳定（可能是 name / course_name / 中文标签「课程名称」等），
 * prompt 未强约束 key 名，故按候选 key 列表依次尝试，找到第一个非空值。
 */
function pickField(
  fields: Record<string, string>,
  payload: Record<string, string> | undefined,
  candidates: string[],
): string {
  for (const key of candidates) {
    const v = (payload?.[key] ?? fields[key] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** 由班级名（或含班级名的字符串）在 dashboard 里反查 class_id；LLM 只知道班级名不知道内部 id。 */
function resolveClassId(
  classes: { id: string; name: string }[],
  rawName: string,
): string {
  const name = rawName.trim();
  if (!name) return "";
  // 先精确匹配，再包含匹配（LLM 可能把「2026 级 1 班」念成「2026 年 1 月」，包含匹配兜底）
  const exact = classes.find((c) => c.name === name);
  if (exact) return exact.id;
  const partial = classes.find(
    (c) => c.name.includes(name) || name.includes(c.name),
  );
  return partial?.id ?? "";
}

export function AgentWorkbench({
  mode,
  openPanel,
  conversationId,
  onConversationSaved,
}: {
  mode: "admin" | "teacher";
  openPanel?: (kind: string, props?: Record<string, unknown>) => void;
  /** 侧栏选中的会话 id；变化时载入其消息。null/undefined = 新对话（空白）。 */
  conversationId?: string | null;
  /** 会话保存后回调（用于刷新侧栏列表并同步高亮 id）。 */
  onConversationSaved?: (summary: ConversationSummary) => void;
}) {
  const {
    dashboard,
    setClassDraft,
    createClass,
    setCourseDraft,
    createCourse,
    setStudentDraft,
    createStudent,
    setLessonText,
    setSelectedFiles,
    refresh,
  } = useSession();

  const [entries, setEntries] = useState<WorkbenchEntry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  /** 对话区挂载的文件（教案 zip / 名单 txt 等） */
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 待确认的名单解析结果（confirm_import_roster 用） */
  const pendingRosterRef = useRef<{
    rows: { name: string; username: string; password: string }[];
    classId: string;
  } | null>(null);

  /** 读取附件文本并解析为名单行（姓名,账号,密码；后两列可空）。 */
  async function parseRosterFiles(files: File[]) {
    const rows: { name: string; username: string; password: string }[] = [];
    for (const f of files) {
      try {
        const text = await f.text();
        text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .forEach((line) => {
            const cols = line.split(/[,\t，]/).map((c) => c.trim());
            if (cols[0]) {
              rows.push({
                name: cols[0],
                username: cols[1] ?? "",
                password: cols[2] ?? "",
              });
            }
          });
      } catch {
        /* 二进制读不出文本则跳过该文件 */
      }
    }
    return rows;
  }

  function buildWorkspaceContext(files: File[]): string {
    const course = currentCourse(dashboard);
    const classes = (dashboard?.classes ?? []).filter((c) => !c.archived);
    const courses = (dashboard?.courses ?? []).filter((c) => !c.archived);
    const lessons = (dashboard?.lessons ?? []).filter((l) => !l.archived);
    const homeworks = (dashboard?.homeworks ?? []).filter((h) => !h.archived);
    const students = dashboard?.students ?? [];
    const lines = [
      `角色工作台：${mode === "admin" ? "超管" : "教师"}`,
      `当前课程：${course?.name || "（未选）"} id=${course?.id || ""}`,
      `班级数=${classes.length}：${classes
        .slice(0, 6)
        .map((c) => c.name)
        .join("、") || "无"}`,
      `课程数=${courses.length}，资料数=${lessons.length}，作业数=${homeworks.length}，学生数=${students.length}`,
      files.length
        ? `对话区已挂附件 ${files.length} 个：${files
            .map((f) => `${f.name}(${formatBytes(f.size)})`)
            .join("；")}`
        : "对话区附件：无",
      "可用面板：student-list, student-import, materials-upload, homework-form, class-profile, overview, llm-config",
      "能力：建班/建课/建学生、批量导名单、智能导资料、发作业、班级报告、知识点拆解",
    ];
    return lines.join("\n");
  }

  // 当前活动会话 id（自动保存后回填），与侧栏 conversationId 同步。
  const activeIdRef = useRef<string | null>(conversationId ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 载入会话时抑制一次自动保存，避免刚载入就回写。
  const skipSaveRef = useRef(false);

  // conversationId 变化：null → 清空（新对话）；有值且与当前不同 → 载入其消息。
  useEffect(() => {
    const target = conversationId ?? null;
    if (target === activeIdRef.current) return;
    activeIdRef.current = target;
    if (!target) {
      skipSaveRef.current = true;
      setEntries([]);
      return;
    }
    let alive = true;
    api
      .getConversation(target)
      .then((conv) => {
        if (!alive) return;
        skipSaveRef.current = true;
        setEntries(messagesToEntries(conv.messages ?? []));
        scrollToBottom();
      })
      .catch(() => {
        /* 载入失败静默，保持当前对话 */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // 防抖自动保存：entries 变化 → 800ms 后 upsert 到后端。
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (entries.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const req = {
        id: activeIdRef.current ?? undefined,
        title: deriveTitle(entries),
        mode,
        messages: entriesToMessages(entries),
      };
      api
        .saveConversation(req)
        .then((conv) => {
          activeIdRef.current = conv.id;
          onConversationSaved?.({
            id: conv.id,
            title: conv.title,
            mode: conv.mode,
            message_count: conv.messages?.length ?? entries.length,
            updated_at: conv.updated_at,
            created_at: conv.created_at,
          });
        })
        .catch(() => {
          /* 保存失败静默，不打断对话 */
        });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, mode]);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const featured = useMemo(() => featuredCommands(mode), [mode]);
  const menuCommands = useMemo(
    () => (menuOpen ? filterCommands(mode, input) : []),
    [menuOpen, mode, input],
  );

  /** 执行一条斜杠命令：panel 型开面板，prompt 型填入并发送 */
  function runCommand(cmd: SlashCommand) {
    setMenuOpen(false);
    setMenuIndex(0);
    if (cmd.panel) {
      setInput("");
      if (cmd.panel === "__help__") {
        // /help 始终以对话气泡列出能力（无对应抽屉面板）
        openHelp();
      } else if (openPanel && hasPanel(cmd.panel)) {
        openPanel(cmd.panel);
      } else {
        // 面板尚未接入（后续步骤）时，回退到能力清单，避免死点击
        openHelp();
      }
      return;
    }
    if (cmd.prompt) {
      setInput("");
      handleSend(cmd.prompt);
    }
  }

  /** 以对话气泡形式列出当前角色的全部能力（/help 兜底 & 无面板时） */
  function openHelp() {
    const all = filterCommands(mode, "");
    const lines = all.map((c) => `/${c.trigger} — ${c.label}：${c.description}`);
    setEntries((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}-help`,
        role: "agent",
        directive: {
          reply: "这些是你可以直接说或用斜杠调用的能力：",
          intent: "chat",
          llm_status: "ok",
          cards: [
            {
              type: "info",
              title: "可用指令",
              items: lines,
            },
          ],
        },
      },
    ]);
    scrollToBottom();
  }

  function toHistory(list: WorkbenchEntry[]): AgentTurn[] {
    return list.map((e) =>
      e.role === "user"
        ? { role: "user", content: e.text }
        : { role: "assistant", content: e.directive.reply },
    );
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }

  async function handleSend(overrideText?: string) {
    const message = (overrideText ?? input).trim();
    if (!message || sending) return;
    // 自然语言"帮助/能做什么"整句拦截 → 弹能力清单，不发后端
    if (isHelpPhrase(message)) {
      if (!overrideText) setInput("");
      openHelp();
      return;
    }
    if (!overrideText) setInput("");
    const history = toHistory(entries);
    const userEntry: WorkbenchEntry = {
      id: `u-${Date.now()}`,
      role: "user",
      text: message,
    };
    setEntries((prev) => [...prev, userEntry]);

    // —— 对话区文件直达：挂文件 + 明确意图时本地闭环，不必等后端 directive ——
    const rosterish = /名单|花名册|学生|账号|批量导入|导学生/.test(message);
    const materialish = /资料|教案|知识库|导入|上传|教材|讲义/.test(message);
    if (pendingFiles.length > 0 && rosterish) {
      setSending(true);
      scrollToBottom();
      try {
        const rows = await parseRosterFiles(pendingFiles);
        const clsId = currentCourse(dashboard)?.class_id ?? "";
        pendingRosterRef.current = { rows, classId: clsId };
        const preview = rows.slice(0, 5).map(
          (r) => `${r.name}${r.username ? `（${r.username}）` : ""}`,
        );
        setEntries((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}-roster`,
            role: "agent",
            directive:
              rows.length === 0
                ? {
                    reply:
                      "附件里没有解析到名单行。请确认是 txt/csv，每行「姓名,账号,密码」（后两列可空）。",
                    intent: "import_students",
                    llm_status: "ok",
                  }
                : {
                    reply: `已从附件解析出 ${rows.length} 名学生，确认后写入当前班级${clsId ? "" : "（未识别班级，将用默认班）"}。`,
                    intent: "import_students",
                    llm_status: "ok",
                    cards: [
                      {
                        type: "confirm",
                        title: `名单预览（共 ${rows.length} 人）`,
                        items: [
                          ...preview,
                          ...(rows.length > 5
                            ? [`…等共 ${rows.length} 人`]
                            : []),
                        ],
                      },
                    ],
                    choices: [
                      {
                        label: `确认导入 ${rows.length} 人`,
                        action: "confirm_import_roster",
                        style: "primary",
                      },
                      { label: "取消", action: "dismiss", style: "secondary" },
                    ],
                  },
          },
        ]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
      return;
    }
    if (pendingFiles.length > 0 && materialish) {
      setSending(true);
      scrollToBottom();
      try {
        const activeCourse = currentCourse(dashboard);
        const report = await api.uploadMaterials(
          pendingFiles,
          "",
          { courseId: activeCourse?.id },
        );
        setPendingFiles([]);
        setSelectedFiles([]);
        setLessonText("");
        await refresh();
        const stats = report.stats;
        const accepted = stats?.accepted ?? report.total ?? 0;
        const skipped = stats?.skipped ?? report.skipped?.length ?? 0;
        const importedLines = (report.imported ?? [])
          .slice(0, 3)
          .map((i) => `✓ ${i.title}（${i.kind_label ?? "资料"}）`);
        const skippedLines = (report.skipped ?? [])
          .slice(0, 3)
          .map((s) => `✗ ${s.file_name}：${s.reason}`);
        setEntries((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}-import`,
            role: "agent",
            directive: {
              reply:
                report.intent?.summary ||
                `导入完成：入库 ${accepted}，跳过 ${skipped}。`,
              intent: "upload_materials",
              llm_status: "ok",
              cards: [
                {
                  type: "data",
                  title: `导入报告 · 入库 ${accepted} / 跳过 ${skipped}`,
                  items: [...importedLines, ...skippedLines],
                },
              ],
              choices: [
                {
                  label: "打开导入面板看完整报告",
                  action: "open_panel",
                  payload: { panel: "materials-upload" },
                  style: "secondary",
                },
              ],
            },
          },
        ]);
      } catch (e) {
        setEntries((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}-import-err`,
            role: "agent",
            directive: {
              reply:
                e instanceof Error ? `导入失败：${e.message}` : "导入失败，请重试。",
              intent: "upload_materials",
              llm_status: "error",
            },
          },
        ]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
      return;
    }

    setSending(true);
    scrollToBottom();
    try {
      const context = buildWorkspaceContext(pendingFiles);
      const directive = await api.sendAgentCommand({
        message:
          pendingFiles.length > 0
            ? `${message}\n\n[系统] 用户已在对话区附加 ${pendingFiles.length} 个文件：${pendingFiles.map((f) => f.name).join("、")}`
            : message,
        context,
        history,
      });
      setEntries((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "agent", directive },
      ]);
    } catch (e) {
      setEntries((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "agent",
          directive: {
            reply: e instanceof Error ? `请求失败：${e.message}` : "请求失败，请重试。",
            intent: "chat",
            llm_status: "error",
          },
        },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  async function handleChoice(
    entryId: string,
    directive: AgentDirective,
    choice: AgentChoice,
  ) {
    const fields = directive.cards?.[0]?.fields ?? {};
    const payload = choice.payload;
    const classes = dashboard?.classes ?? [];
    // LLM 只给班级名，class_id 需在前端反查（内部 id LLM 不知道）
    const classNameRaw = pickField(fields, payload, [
      "class_name",
      "class",
      "class_id",
      "班级",
      "班级名称",
    ]);
    const resolvedClassId = resolveClassId(classes, classNameRaw);
    switch (choice.action) {
      case "create_class":
        setClassDraft({
          name: pickField(fields, payload, ["name", "class_name", "班级", "班级名称"]),
          grade: pickField(fields, payload, ["grade", "年级", "学期"]),
          teacher_id: "",
        });
        await createClass();
        break;
      case "create_course":
        setCourseDraft({
          name: pickField(fields, payload, [
            "name",
            "course_name",
            "course",
            "课程名称",
            "课程",
          ]),
          // class_id 空时后端兜底到教师默认班级；有反查结果则用反查值
          class_id: resolvedClassId,
        });
        await createCourse();
        break;
      case "create_student":
        setStudentDraft({
          name: pickField(fields, payload, [
            "name",
            "student_name",
            "姓名",
            "学生姓名",
          ]),
          class_id: resolvedClassId,
          username: "",
          password: "",
          create_user: false,
        });
        await createStudent();
        break;
      case "publish_homework": {
        setSending(true);
        try {
          const activeCourse = currentCourse(dashboard);
          const lastUserText =
            [...entries].reverse().find((e) => e.role === "user")?.text ?? "";
          await api.autoCreateHomework({
            courseId: activeCourse?.id ?? "",
            classId: activeCourse?.class_id ?? "",
            lessonContent: lastUserText,
            teacherGoal: lastUserText,
            publish: true,
          });
          await refresh();
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: "作业已生成并发布给对应班级。",
                intent: "publish_homework",
                llm_status: "ok",
              },
            },
          ]);
        } catch (e) {
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: e instanceof Error ? `发布失败：${e.message}` : "发布失败，请重试。",
                intent: "publish_homework",
                llm_status: "error",
              },
            },
          ]);
        } finally {
          setSending(false);
        }
        break;
      }
      case "import_students": {
        if (openPanel && hasPanel("student-import")) {
          openPanel("student-import");
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply:
                  "已打开「批量导入学生」。粘贴「姓名,账号,密码」或逐行姓名，确认后写入后端。若对话区挂了名单 txt，也可复制进面板。",
                intent: "import_students",
                llm_status: "ok",
              },
            },
          ]);
        } else {
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: "当前环境未挂载导入面板，请用侧栏「导入名单」或 /导入名单。",
                intent: "import_students",
                llm_status: "error",
              },
            },
          ]);
        }
        break;
      }
      case "confirm_import_roster": {
        const pending = pendingRosterRef.current;
        if (!pending || pending.rows.length === 0) {
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: "名单已失效，请重新挂文件并发起导入。",
                intent: "import_students",
                llm_status: "error",
              },
            },
          ]);
          break;
        }
        setSending(true);
        try {
          const res = await api.importStudentsBulk({
            class_id: pending.classId,
            create_user: true,
            rows: pending.rows,
          });
          pendingRosterRef.current = null;
          setPendingFiles([]);
          await refresh();
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entryId && e.role === "agent"
                ? { ...e, dismissed: true }
                : e,
            ),
          );
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}-roster-done`,
              role: "agent",
              directive: {
                reply: `名单导入完成：成功 ${res.created} 人，失败 ${res.failed} 人。`,
                intent: "import_students",
                llm_status: "ok",
                cards:
                  res.failed > 0
                    ? [
                        {
                          type: "data",
                          title: `失败 ${res.failed} 条（前 3 条）`,
                          items: res.errors.slice(0, 3),
                        },
                      ]
                    : undefined,
                choices: [
                  {
                    label: "查看学生名单",
                    action: "open_panel",
                    payload: { panel: "student-list" },
                    style: "secondary",
                  },
                ],
              },
            },
          ]);
        } catch (e) {
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}-roster-err`,
              role: "agent",
              directive: {
                reply:
                  e instanceof Error
                    ? `导入失败：${e.message}`
                    : "导入失败，请重试。",
                intent: "import_students",
                llm_status: "error",
              },
            },
          ]);
        } finally {
          setSending(false);
          scrollToBottom();
        }
        break;
      }
      case "upload_materials": {
        // 有挂文件：直接智能导入并回报报告卡；否则打开上传面板
        if (pendingFiles.length > 0) {
          setSending(true);
          try {
            const activeCourse = currentCourse(dashboard);
            const report = await api.uploadMaterials(pendingFiles, "", {
              courseId: activeCourse?.id,
            });
            setPendingFiles([]);
            setSelectedFiles([]);
            setLessonText("");
            await refresh();
            const stats = report.stats;
            const accepted = stats?.accepted ?? report.total ?? 0;
            const skipped = stats?.skipped ?? report.skipped?.length ?? 0;
            const importedLines = (report.imported ?? [])
              .slice(0, 3)
              .map((i) => `✓ ${i.title}（${i.kind_label ?? "资料"}）`);
            const skippedLines = (report.skipped ?? [])
              .slice(0, 3)
              .map((s) => `✗ ${s.file_name}：${s.reason}`);
            setEntries((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: "agent",
                directive: {
                  reply:
                    report.intent?.summary ||
                    `导入完成：入库 ${accepted}，跳过 ${skipped}。`,
                  intent: "upload_materials",
                  llm_status: "ok",
                  cards: [
                    {
                      type: "data",
                      title: `导入报告 · 入库 ${accepted} / 跳过 ${skipped}`,
                      items: [...importedLines, ...skippedLines],
                    },
                  ],
                  choices: [
                    {
                      label: "打开导入面板看完整报告",
                      action: "open_panel",
                      payload: { panel: "materials-upload" },
                      style: "secondary",
                    },
                  ],
                },
              },
            ]);
          } catch (e) {
            setEntries((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: "agent",
                directive: {
                  reply:
                    e instanceof Error
                      ? `导入失败：${e.message}`
                      : "导入失败，请重试。",
                  intent: "upload_materials",
                  llm_status: "error",
                },
              },
            ]);
          } finally {
            setSending(false);
            scrollToBottom();
          }
        } else if (openPanel && hasPanel("materials-upload")) {
          const lastUserText =
            [...entries].reverse().find((e) => e.role === "user")?.text ?? "";
          const textOnly = lastUserText.replace(/\[系统\][\s\S]*$/, "").trim();
          if (textOnly) setLessonText(textOnly);
          openPanel("materials-upload");
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply:
                  "已打开资料导入面板。也可先在下方 📎 挂 zip/pdf/docx，再说「帮我导入这些资料」。",
                intent: "upload_materials",
                llm_status: "ok",
              },
            },
          ]);
        } else {
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: "当前环境未挂载导入面板，请从资料库点「导入」。",
                intent: "upload_materials",
                llm_status: "error",
              },
            },
          ]);
        }
        break;
      }
      case "send_command": {
        const command = choice.payload?.command;
        if (command === "class_report") {
          await handleSend("给我看一下班级的共性问题和教学建议报告。");
        } else if (command === "knowledge_analysis") {
          const lastUserText =
            [...entries].reverse().find((e) => e.role === "user")?.text ?? "";
          await handleSend(`请拆解以下内容的知识点与难点：${lastUserText}`);
        } else if (command) {
          await handleSend(command);
        }
        break;
      }
      case "open_panel": {
        const kind =
          choice.payload?.panel ||
          choice.payload?.kind ||
          fields.panel ||
          "";
        if (kind && openPanel) {
          openPanel(kind, choice.payload as Record<string, unknown>);
          setEntries((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "agent",
              directive: {
                reply: `已打开面板：${kind}`,
                intent: "open_panel",
                llm_status: "ok",
              },
            },
          ]);
        }
        break;
      }
      case "dismiss": {
        // 收起该条 agent 消息的卡片与操作按钮，仅保留回复文本并标记「已取消」
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId && e.role === "agent"
              ? { ...e, dismissed: true }
              : e,
          ),
        );
        break;
      }
      default:
        break;
    }
  }

  function toggleListening() {
    if (!speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const text = extractSpeechText(event);
      if (text) setInput(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <section
      data-lenis-prevent
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
            <AIBlob size={72} className="!h-9 !w-9 scale-[0.5] origin-top-left" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              {mode === "admin" ? "超管 · Agent 指挥台" : "教师 · Agent 工作台"}
            </h2>
            <p className="text-xs text-muted-foreground">
              用自然语言或语音下指令，输入 <kbd className="rounded bg-muted px-1">/</kbd> 查看全部能力
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
        {featured.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => runCommand(cmd)}
            title={cmd.description}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        data-lenis-prevent
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-5 py-4"
      >
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            试试说「帮我新建一个班级」「给我看下班级报告」，或输入{" "}
            <kbd className="rounded bg-muted px-1">/</kbd>{" "}
            浏览全部指令、点上方胶囊快捷开始。
          </p>
        )}
        {entries.map((entry) =>
          entry.role === "user" ? (
            <div key={entry.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground">
                {entry.text}
              </div>
            </div>
          ) : (
            <div key={entry.id} className="flex">
              <DirectiveBubble
                directive={entry.directive}
                dismissed={entry.dismissed}
                disabled={sending}
                streaming={sending}
                onChoice={(choice) =>
                  handleChoice(entry.id, entry.directive, choice)
                }
              />
            </div>
          ),
        )}
        {sending && (
          <div className="flex">
            <div className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              思考中…
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-border p-3">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {pendingFiles.map((f) => (
              <span
                key={f.name + f.size}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
              >
                📎 {f.name} ({formatBytes(f.size)})
                <button
                  type="button"
                  onClick={() =>
                    setPendingFiles((arr) => arr.filter((x) => x !== f))
                  }
                  className="rounded-full p-0.5 hover:bg-brand/10"
                  aria-label="移除附件"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="挂载教案/名单文件"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".zip,.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.sql"
            className="hidden"
            onChange={(e) => {
              const arr = Array.from(e.target.files || []);
              setPendingFiles((prev) => [...prev, ...arr]);
              if (e.target) e.currentTarget.value = "";
            }}
          />
          <div className="relative flex-1">
            <SlashCommandMenu
              open={menuOpen}
              commands={menuCommands}
              activeIndex={menuIndex}
              onPick={runCommand}
            />
            <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              const isSlash = v.startsWith("/");
              setMenuOpen(isSlash);
              if (isSlash) setMenuIndex(0);
            }}
            onKeyDown={(e) => {
              // 斜杠菜单键控优先
              if (menuOpen && menuCommands.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMenuIndex((i) => (i + 1) % menuCommands.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMenuIndex(
                    (i) => (i - 1 + menuCommands.length) % menuCommands.length,
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  runCommand(menuCommands[menuIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMenuOpen(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !sending) handleSend();
              }
            }}
            placeholder="说出或输入指令；📎 挂文件后再说「导入资料」可一键入库"
            className="max-h-32 min-h-[44px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        {speechSupported && (
          <button
            onClick={toggleListening}
            aria-label={listening ? "停止录音" : "语音输入"}
            className={
              listening
                ? "inline-flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-lg bg-red-500 text-white"
                : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            }
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button
          onClick={() => handleSend()}
          disabled={sending || !input.trim()}
          aria-label="发送"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
        </div>
      </footer>
    </section>
  );
}
