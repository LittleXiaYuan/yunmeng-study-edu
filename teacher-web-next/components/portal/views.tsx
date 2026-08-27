"use client";

import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileUp,
  GraduationCap,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  XCircle,
} from "lucide-react";
// MessageCircle/Send used by deprecated AgentPanel only
import { useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import StaggeredText from "@/components/staggered-text";
import { LessonLibrary } from "./lessons/lesson-library";
import { fieldCls, primaryBtnCls } from "./page-kit";
import type { OpenPanel } from "./panel-registry";
import { DataTable, KpiCard, MiniList, Panel } from "./ui";
import {
  currentCourse,
  formatBytes,
  latestLesson,
} from "@/lib/portal-helpers";

// ---- Overview (KPI + tables) ----

export function OverviewView({ role }: { role: "admin" | "teacher" }) {
  const { dashboard: d, user } = useSession();
  const published = (d?.homeworks ?? []).filter((h) => h.published).length;
  // 工作台概览：少堆 KPI，强调近期内容；上方快捷入口由 portal 负责
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 px-4 sm:px-0 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            {role === "admin" ? "平台总览" : "教学工作台"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            {user?.name ?? "老师"}，欢迎回来
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            {currentCourse(d)?.name ?? "数据库原理"}
            <span className="mx-1.5 text-border">·</span>
            已发布 {published} 个任务
          </p>
          {/* 错落入场：欢迎语 / 平台标语 字符依次飞入 */}
          <div className="mt-3 max-w-2xl text-sm text-muted-foreground/90 sm:text-base">
            <StaggeredText
              text={`${user?.name ?? "老师"}，欢迎回来 · ${currentCourse(d)?.name ?? "数据库原理"} · 已发布 ${published} 个任务 · 信任分门控 · 屏幕感知 · RAG 检索`}
              as="p"
              segmentBy="words"
              delay={26}
              duration={0.42}
              className="leading-relaxed"
            />
          </div>
        </div>
      </header>

      {/* 只保留 2 个有意义的数字 + 一张近期表，避免 KPI 墙。移动端单列，≥sm 双列。 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <KpiCard
          icon={<Database size={19} />}
          label="教案资料"
          value={d?.lessons.length ?? 0}
          detail={latestLesson(d)?.title ?? "等待导入"}
        />
        <KpiCard
          icon={
            role === "admin" ? (
              <GraduationCap size={19} />
            ) : (
              <ClipboardList size={19} />
            )
          }
          label={role === "admin" ? "学生" : "已发布任务"}
          value={
            role === "admin" ? (d?.students.length ?? 0) : published
          }
          detail={
            role === "admin"
              ? (currentCourse(d)?.name ?? "暂无课程")
              : "学生端可见"
          }
        />
      </section>

      <DataTable
        title={role === "admin" ? "最近资料" : "任务一览"}
        rows={
          role === "admin"
            ? (d?.lessons ?? [])
                .slice()
                .reverse()
                .map((l) => [
                  l.title,
                  l.file_name || "手动资料",
                  l.analysis?.concepts?.slice(0, 3).join("、") || "-",
                ])
            : (d?.homeworks ?? [])
                .filter((h) => !h.archived)
                .slice()
                .reverse()
                .map((h) => [
                  h.title,
                  h.published ? "已发布" : "草稿",
                  `${(h.steps || []).length} 步`,
                ])
        }
        empty={
          role === "admin"
            ? "暂无资料 — 可从侧栏导入"
            : "暂无任务 — 去侧栏发布"
        }
      />
    </div>
  );
}

// ---- Materials (upload) ----

/** 仅上传表单（适合抽屉）；成功后展示 Agent 导入报告，不立刻关抽屉。 */
export function MaterialsUploadForm({
  onDone,
  bare,
}: {
  onDone?: () => void;
  bare?: boolean;
}) {
  const {
    dashboard,
    selectedFiles,
    setSelectedFiles,
    lessonText,
    setLessonText,
    uploadMaterials,
    lastUploadReport,
    clearUploadReport,
    busy,
  } = useSession();

  const courses = (dashboard?.courses ?? []).filter((c) => !c.archived);
  const [courseId, setCourseId] = useState(
    courses[0]?.id ?? "course_db",
  );
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadBusy = busy === "upload";

  function openFilePicker() {
    if (uploadBusy || !fileInputRef.current) return;
    // 清空原生 input 的值，确保重新选择同一个文件也会触发 change。
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  function clearSelectedFiles() {
    clearUploadReport();
    setSelectedFiles([]);
  }

  function removeSelectedFile(index: number) {
    clearUploadReport();
    setSelectedFiles(selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  }

  const canUpload =
    (selectedFiles.length > 0 || lessonText.trim().length > 0) &&
    !!courseId.trim();

  const report = lastUploadReport;
  const stats = report?.stats;

  return (
    <div
      className={
        bare
          ? "flex flex-col gap-4"
          : "flex flex-col gap-4 p-5 sm:p-6"
      }
    >
      <p className="text-sm text-muted-foreground">
        Agent 会识别意图：区分教案 / 练习 / 噪声，只把有用材料写入课程知识库并解析概念。
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          所属课程 *
        </span>
        <select
          className={fieldCls}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {courses.length === 0 && (
            <option value="course_db">数据库原理（默认）</option>
          )}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          标题（可选，多文件时用文件名）
        </span>
        <input
          className={fieldCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：第3章 关系模型"
        />
      </label>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,.docx,.pptx,.xlsx,.pdf,.txt,.md,.csv,.json,.sql"
        className="hidden"
        disabled={uploadBusy}
        aria-label="选择教案文件"
        onChange={(e) => {
          clearUploadReport();
          setSelectedFiles(Array.from(e.target.files || []));
        }}
      />
      <button
        type="button"
        disabled={uploadBusy}
        onClick={openFilePicker}
        className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors ${uploadBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand/30 hover:bg-muted/50"}`}
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <UploadCloud size={20} />
        </span>
        <strong className="text-sm">
          {selectedFiles.length
            ? "点击重新选择文件"
            : "点击选择文件"}
        </strong>
        <span className="text-xs text-muted-foreground">
          {selectedFiles.length
            ? `当前已选 ${selectedFiles.length} 个；重新选择会替换当前列表`
            : "zip · pdf · docx · pptx · xlsx · txt · sql"}
        </span>
      </button>
      {selectedFiles.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/20 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              待导入 {selectedFiles.length} 个文件
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={uploadBusy}
                onClick={openFilePicker}
                className="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                重新选择
              </button>
              <button
                type="button"
                disabled={uploadBusy}
                onClick={clearSelectedFiles}
                className="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空全部
              </button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/75 px-3 py-2"
              >
                <FileUp size={16} className="shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={uploadBusy}
                  onClick={() => removeSelectedFile(index)}
                  aria-label={`移除文件 ${file.name}`}
                  title={`移除 ${file.name}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <textarea
        value={lessonText}
        onChange={(e) => {
          clearUploadReport();
          setLessonText(e.target.value);
        }}
        placeholder="也可以直接粘贴教案片段、课程目标或知识点列表。"
        className={fieldCls + " min-h-[100px] resize-y"}
      />

      {report && (
        <div className="rounded-2xl border border-brand/25 bg-brand-soft/40 p-4">
          <div className="mb-3 flex items-start gap-2">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {report.intent?.label || "导入报告"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {report.intent?.summary || report.message}
              </p>
            </div>
          </div>
          {stats && (
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-background/80 px-2.5 py-1 font-medium tabular-nums">
                入库 {stats.accepted}
              </span>
              <span className="rounded-full bg-background/80 px-2.5 py-1 font-medium tabular-nums">
                跳过 {stats.skipped}
              </span>
              {stats.lessons > 0 && (
                <span className="rounded-full bg-background/80 px-2.5 py-1 tabular-nums">
                  教案 {stats.lessons}
                </span>
              )}
              {stats.homework > 0 && (
                <span className="rounded-full bg-background/80 px-2.5 py-1 tabular-nums">
                  练习 {stats.homework}
                </span>
              )}
              {stats.noise > 0 && (
                <span className="rounded-full bg-background/80 px-2.5 py-1 tabular-nums text-muted-foreground">
                  噪声 {stats.noise}
                </span>
              )}
            </div>
          )}
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {(report.imported ?? []).map((item) => (
              <li
                key={`${item.lesson_id}-${item.file_name}`}
                className="rounded-xl border border-border/80 bg-background/70 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    size={15}
                    className="mt-0.5 shrink-0 text-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.title}
                      {item.kind_label ? (
                        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                          {item.kind_label}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {item.file_name}
                      {item.confidence
                        ? ` · 置信 ${item.confidence}%`
                        : ""}
                      {item.content_length
                        ? ` · ${item.content_length} 字`
                        : ""}
                    </p>
                    {item.reason && (
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                        {item.reason}
                      </p>
                    )}
                    {item.concepts && item.concepts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.concepts.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {(report.skipped ?? []).map((item) => (
              <li
                key={`skip-${item.file_name}-${item.reason}`}
                className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <XCircle
                    size={15}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">
                      {item.file_name}
                      {item.kind_label ? (
                        <span className="ml-2 text-[10px]">
                          {item.kind_label}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.reason}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() =>
            uploadMaterials(undefined, {
              courseId,
              title: title.trim() || undefined,
            })
          }
          disabled={busy === "upload" || !canUpload}
          className={primaryBtnCls}
        >
          <UploadCloud size={17} />
          {busy === "upload" ? "Agent 解析中…" : "确认导入"}
        </button>
        {onDone && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              clearUploadReport();
              onDone();
            }}
          >
            {report ? "完成并关闭" : "取消"}
          </button>
        )}
      </div>
    </div>
  );
}

/** 资料库：列表可查看/编辑/归档；上传可选内嵌或经 openPanel 抽屉。 */
export function DataOpsView({
  showUpload = false,
  openPanel,
}: {
  showUpload?: boolean;
  openPanel?: OpenPanel;
}) {
  return (
    <div className="flex flex-col gap-6">
      {showUpload && (
        <Panel
          icon={<FileUp size={18} />}
          title="导入教案资料"
          desc="拖入或选择文件；也可粘贴文本。"
        >
          <MaterialsUploadForm bare />
        </Panel>
      )}
      <div className="surface-card overflow-hidden">
        <LessonLibrary openPanel={openPanel} />
      </div>
    </div>
  );
}

// ---- People (create class / course / student) ----

/** 班级 / 课程 / 单人建号表单（超管「班级课程」）。 */
export function PeopleOpsView() {
  const {
    dashboard,
    classDraft,
    setClassDraft,
    createClass,
    courseDraft,
    setCourseDraft,
    createCourse,
    studentDraft,
    setStudentDraft,
    createStudent,
    busy,
  } = useSession();

  const classes = (dashboard?.classes ?? []).filter((c) => !c.archived);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          icon={<ShieldCheck size={18} />}
          title="班级"
          desc="决定教师、课程、资料与学生端可见范围。"
        >
          <div className="flex flex-col gap-3">
            <input
              className={fieldCls}
              value={classDraft.name}
              onChange={(e) =>
                setClassDraft({ ...classDraft, name: e.target.value })
              }
              placeholder="班级名称，例如 计科 2401"
            />
            <input
              className={fieldCls}
              value={classDraft.grade}
              onChange={(e) =>
                setClassDraft({ ...classDraft, grade: e.target.value })
              }
              placeholder="年级，例如 2024 级"
            />
            <button
              type="button"
              className={primaryBtnCls + " w-full"}
              onClick={createClass}
              disabled={busy === "class"}
            >
              <Plus size={16} />
              保存班级
            </button>
          </div>
        </Panel>

        <Panel
          icon={<BookOpen size={18} />}
          title="课程"
          desc="课程关联班级，资料与任务跟随课程归属。"
        >
          <div className="flex flex-col gap-3">
            <input
              className={fieldCls}
              value={courseDraft.name}
              onChange={(e) =>
                setCourseDraft({ ...courseDraft, name: e.target.value })
              }
              placeholder="课程名称，例如 数据库原理"
            />
            <select
              className={fieldCls}
              value={courseDraft.class_id}
              onChange={(e) =>
                setCourseDraft({ ...courseDraft, class_id: e.target.value })
              }
            >
              <option value="">选择班级</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={primaryBtnCls + " w-full"}
              onClick={createCourse}
              disabled={busy === "course"}
            >
              <Plus size={16} />
              保存课程
            </button>
          </div>
        </Panel>

        <Panel
          icon={<UserPlus size={18} />}
          title="学生端账号"
          desc="创建后学生可用手机或 PC 登录同一前端。"
        >
          <div className="flex flex-col gap-3">
            <input
              className={fieldCls}
              value={studentDraft.name}
              onChange={(e) =>
                setStudentDraft({ ...studentDraft, name: e.target.value })
              }
              placeholder="学生姓名"
            />
            <select
              className={fieldCls}
              value={studentDraft.class_id}
              onChange={(e) =>
                setStudentDraft({ ...studentDraft, class_id: e.target.value })
              }
            >
              <option value="">选择班级</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className={fieldCls}
              value={studentDraft.username}
              onChange={(e) =>
                setStudentDraft({ ...studentDraft, username: e.target.value })
              }
              placeholder="登录账号，不填则用 student ID"
            />
            <input
              className={fieldCls}
              value={studentDraft.password}
              onChange={(e) =>
                setStudentDraft({ ...studentDraft, password: e.target.value })
              }
              placeholder="初始密码"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={studentDraft.create_user}
                onChange={(e) =>
                  setStudentDraft({
                    ...studentDraft,
                    create_user: e.target.checked,
                  })
                }
              />
              同时创建学生登录账号
            </label>
            <button
              type="button"
              className={primaryBtnCls + " w-full"}
              onClick={createStudent}
              disabled={busy === "student"}
            >
              <UserPlus size={16} />
              保存学生端
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
        <MiniList
          title="班级"
          items={(dashboard?.classes ?? []).map(
            (c) => `${c.name}${c.grade ? ` · ${c.grade}` : ""}`,
          )}
        />
        <MiniList
          title="学生画像"
          items={(dashboard?.students ?? []).map((s) => s.name)}
        />
      </section>
    </div>
  );
}

// ---- Agent chat panel ----

/**
 * @deprecated 旧版对话面板。管理/教师端已升级为全屏 AgentWorkbench（含 directive 卡片/斜杠命令/语音）。
 * 保留仅为回退参考，不在任何 portal 挂载。
 */
export function AgentPanel({ mode }: { mode: "admin" | "teacher" | "student" }) {
  const { messages, input, setInput, sendAgentMessage, busy } = useSession();

  return (
    <section className="flex h-[calc(100vh-13rem)] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageCircle size={17} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">上下文 Agent 引导</h2>
      </div>
      <div
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            把课题发给我，我会结合课程资料、RAG 命中与学生画像给出步骤卡。
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-2.5 text-sm"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy === "chat" && (
          <div className="flex">
            <div className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              思考中…
            </div>
          </div>
        )}
      </div>
      <footer className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && busy !== "chat") sendAgentMessage();
            }
          }}
          placeholder={
            mode === "student"
              ? "问 Agent：这一步我该怎么写？"
              : "问我：如何设计一个数据库？"
          }
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <button
          onClick={() => sendAgentMessage()}
          disabled={busy === "chat" || !input.trim()}
          aria-label="发送"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </footer>
    </section>
  );
}
