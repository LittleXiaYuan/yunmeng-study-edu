import type {
  AgentDirective,
  AgentTurn,
  ChatMessage,
  ClassDraft,
  CodeReviewLanguagesResponse,
  CodeReviewRequest,
  CodeReviewResult,
  Conversation,
  ConversationSummary,
  CourseDraft,
  Dashboard,
  HomeworkDraft,
  HomeworkTask,
  Lesson,
  LLMConfig,
  Paged,
  RetrievalHit,
  RetrievalIndexStats,
  SaveConversationRequest,
  School,
  Student,
  StudentDetail,
  StudentDraft,
  StudentListItem,
  User,
} from "./types";

// Desktop packaging sets NEXT_PUBLIC_API_BASE_URL=same-origin so fetch uses
// relative paths (""). Empty env values are unreliable with Next inlining.
function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (raw === undefined || raw === null) {
    return "http://127.0.0.1:18080";
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "same-origin" || trimmed === ".") {
    return "";
  }
  return trimmed.replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiBase();

const TOKEN_KEY = "token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Thrown on HTTP 401 so callers can trigger a logout. */
export class UnauthorizedError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** 通用 fetch 超时（ms）。避免后端挂掉时 SessionProvider 永远卡在 loading。 */
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // 始终带超时：浏览器 fetch 默认不设，等待可能几十秒到几分钟
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`请求超时（${timeoutMs}ms），请检查后端是否可达`);
    }
    throw e instanceof Error ? e : new Error("网络请求失败");
  }
  clearTimeout(timer);
  if (!res.ok) {
    if (res.status === 401) {
      throw new UnauthorizedError();
    }
    let err = "";
    try {
      const errObj = (await res.json()) as { error?: string; message?: string };
      err = errObj.error || errObj.message || "";
    } catch {
      err = await res.text();
    }
    throw new Error(err || "Request failed");
  }
  return (await res.json()) as T;
}

const jsonHeaders = { "Content-Type": "application/json" } as const;

/** Backend sometimes wraps payloads in `{data}` / `{user}`; unwrap defensively. */
function unwrap<T>(payload: unknown, key: "data" | "user"): T {
  if (payload && typeof payload === "object" && key in payload) {
    return (payload as Record<string, unknown>)[key] as T;
  }
  return payload as T;
}

// ---- Auth ----

export interface LoginResponse {
  token?: string;
  user?: User;
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const res = await apiFetch<LoginResponse & User>("/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  const user = unwrap<User>(res, "user");
  return { token: res.token ?? "", user };
}

export async function fetchMe(): Promise<User> {
  const res = await apiFetch<{ user?: User } & User>("/auth/me");
  return unwrap<User>(res, "user");
}

export async function fetchDashboard(): Promise<Dashboard> {
  const res = await apiFetch<{ data?: Dashboard } & Dashboard>(
    "/edu/dashboard",
  );
  return unwrap<Dashboard>(res, "data");
}

// ---- LLM config ----

export async function getLLMConfig(): Promise<LLMConfig | null> {
  return apiFetch<LLMConfig>("/edu/llm/config").catch(() => null);
}

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await apiFetch("/edu/llm/config", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(config),
  });
}

// ---- Materials / lessons ----

export async function listLessons(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  classId?: string;
  archived?: boolean;
}): Promise<Paged<Lesson>> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.pageSize ?? 20));
  if (params.keyword) q.set("keyword", params.keyword);
  if (params.classId) q.set("class_id", params.classId);
  if (params.archived !== undefined) q.set("archived", String(params.archived));
  return apiFetch<Paged<Lesson>>(`/edu/lessons?${q.toString()}`);
}

export async function getLesson(id: string): Promise<Lesson> {
  return apiFetch<Lesson>(`/edu/lessons/${encodeURIComponent(id)}`);
}

/** 创建或更新教案（POST upsert；带 id 时更新）。 */
export async function upsertLesson(req: {
  id?: string;
  course_id: string;
  title: string;
  content: string;
  archived?: boolean;
}): Promise<Lesson> {
  return apiFetch<Lesson>("/edu/lessons", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

/** 显式更新（PUT）；改标题/正文/课程/归档。 */
export async function updateLesson(
  id: string,
  req: {
    course_id?: string;
    title?: string;
    content?: string;
    archived?: boolean;
  },
): Promise<Lesson> {
  return apiFetch<Lesson>(`/edu/lessons/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ id, ...req }),
  });
}

export function archiveLesson(
  id: string,
  archived: boolean,
  courseId: string,
): Promise<Lesson> {
  return updateLesson(id, { archived, course_id: courseId });
}

export async function uploadMaterials(
  files: File[],
  text: string,
  opts?: { courseId?: string; title?: string },
): Promise<import("./types").LessonUploadResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  if (text) {
    formData.append("text", text);
    formData.append("content", text);
  }
  if (opts?.courseId) formData.append("course_id", opts.courseId);
  if (opts?.title) formData.append("title", opts.title);
  // No Content-Type header — the browser sets the multipart boundary.
  return apiFetch("/edu/lessons/upload", { method: "POST", body: formData });
}

// ---- RAG retrieval (teacher/admin) ----

export async function getRetrievalStats(): Promise<RetrievalIndexStats> {
  return apiFetch<RetrievalIndexStats>("/edu/retrieval/stats");
}

export async function searchLessons(params: {
  query: string;
  courseId?: string;
  limit?: number;
}): Promise<{
  query: string;
  course_id?: string;
  index_status: string;
  indexed_count: number;
  hits: RetrievalHit[];
  terms?: string[];
}> {
  return apiFetch("/edu/retrieval/search", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      query: params.query,
      course_id: params.courseId || "",
      limit: params.limit ?? 5,
    }),
  });
}

export async function uploadUserImage(
  userId: string,
  kind: "avatar" | "background",
  file: File,
): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);
  // No Content-Type header — the browser sets the multipart boundary.
  return apiFetch<User>(`/edu/users/${userId}/${kind}`, {
    method: "POST",
    body: formData,
  });
}

// ---- People / structure ----

export async function createClass(draft: ClassDraft): Promise<void> {
  await apiFetch("/edu/classes", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(draft),
  });
}

export async function createCourse(draft: CourseDraft): Promise<void> {
  await apiFetch("/edu/courses", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(draft),
  });
}

export async function createStudent(draft: StudentDraft): Promise<void> {
  await apiFetch("/edu/students", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(draft),
  });
}

/** 分页 / 搜索 / 班级过滤的学生名单（后端已支持这些 query 参数）。 */
export async function listStudents(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  classId?: string;
  archived?: boolean;
}): Promise<Paged<StudentListItem>> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.pageSize ?? 20));
  if (params.keyword) q.set("keyword", params.keyword);
  if (params.classId) q.set("class_id", params.classId);
  if (params.archived !== undefined) q.set("archived", String(params.archived));
  return apiFetch<Paged<StudentListItem>>(`/edu/students?${q.toString()}`);
}

/**
 * 学生 upsert（POST /edu/students 既是建号也是改档）。
 * 后端对已存在 id 的空字段沿用旧值、archived 仅在非空时改动，
 * 因此归档/改名/换班都复用这一路由，零后端改动。
 */
export async function upsertStudent(req: {
  id: string;
  name?: string;
  class_id?: string;
  archived?: boolean;
}): Promise<void> {
  await apiFetch("/edu/students", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

/** 学生详情：Student + 认知记忆 + 学习轨迹（后端 StudentDetail 已拼装）。 */
export async function getStudentDetail(id: string): Promise<StudentDetail> {
  return apiFetch<StudentDetail>(`/edu/students/${encodeURIComponent(id)}`);
}

/** 归档 / 取消归档（软删）——只带 id + archived，其余字段后端沿用。 */
export function archiveStudent(id: string, archived: boolean): Promise<void> {
  return upsertStudent({ id, archived });
}

/** 改名 / 换班——通过 upsert，只带需变更的字段。 */
export function updateStudent(
  id: string,
  changes: { name?: string; class_id?: string },
): Promise<void> {
  return upsertStudent({ id, ...changes });
}

/**
 * 批量建号：MVP 用前端串行循环调 createStudent（无 bulk 路由）。
 * onProgress 回调每完成一条上报进度，便于面板显示进度与错误。
 */
export async function bulkCreateStudents(
  drafts: StudentDraft[],
  onProgress?: (done: number, total: number, lastError?: string) => void,
): Promise<{ created: number; failed: number; errors: string[] }> {
  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < drafts.length; i++) {
    try {
      await createStudent(drafts[i]);
      created += 1;
      onProgress?.(i + 1, drafts.length);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : "创建失败";
      errors.push(`${drafts[i].name || `第 ${i + 1} 行`}：${msg}`);
      onProgress?.(i + 1, drafts.length, msg);
    }
  }
  return { created, failed, errors };
}

// ---- 用户管理（超管） ----

/** 列表查询参数：分页 + 关键词 + 角色 + 班级 + 启用状态。 */
export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: "admin" | "teacher" | "student";
  classId?: string;
  /** 默认 false（仅在用）；true 看全部；undefined 不传该参数。 */
  archived?: boolean;
}

/** 列表用户（超管）。后端会自动通过 sanitizeUser 剥离 password_hash。 */
export async function listUsers(params: ListUsersParams = {}): Promise<Paged<User>> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.pageSize ?? 20));
  if (params.keyword) q.set("keyword", params.keyword);
  if (params.role) q.set("role", params.role);
  if (params.classId) q.set("class_id", params.classId);
  if (params.archived !== undefined) q.set("archived", String(params.archived));
  return apiFetch<Paged<User>>(`/users?${q.toString()}`);
}

/** 新建用户（超管）。role 不传时后端默认按 username 推断，但前端必须显式传。 */
export async function createUser(req: {
  username: string;
  password: string;
  name: string;
  role: "admin" | "teacher" | "student";
  class_ids?: string[];
  student_id?: string;
  school_id?: string;
  active?: boolean;
}): Promise<User> {
  return apiFetch<User>("/users", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

/**
 * 改 / 停用用户。后端 UpdateUserRequest 各字段可空，仅非空字段会更新，
 * 因此 active 传 boolean 可以同时表达"启用"和"停用"。
 */
export async function updateUser(
  id: string,
  changes: {
    name?: string;
    password?: string;
    role?: "admin" | "teacher" | "student";
    class_ids?: string[];
    student_id?: string;
    school_id?: string;
    active?: boolean;
  },
): Promise<User> {
  return apiFetch<User>("/users/update", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id, ...changes }),
  });
}

/** 停用 = updateUser with active:false 的语义糖。 */
export function disableUser(id: string): Promise<User> {
  return updateUser(id, { active: false });
}

// ---- 组织 / 学校（超管） ----

export async function listSchools(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<Paged<School>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("page_size", String(params?.pageSize ?? 50));
  if (params?.keyword) q.set("keyword", params.keyword);
  return apiFetch<Paged<School>>(`/edu/schools?${q.toString()}`);
}

export async function upsertSchool(req: {
  id?: string;
  name: string;
  code?: string;
  archived?: boolean;
}): Promise<School & { message?: string }> {
  return apiFetch<School & { message?: string }>("/edu/schools", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

/** 服务端批量导入学生（整批一次请求；教师限本班，超管任意班）。 */
export async function importStudentsBulk(req: {
  class_id: string;
  create_user: boolean;
  rows: { name: string; username?: string; password?: string }[];
}): Promise<{
  created: number;
  failed: number;
  errors: string[];
  items: Student[];
}> {
  return apiFetch("/edu/students/import", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

// ---- Agent chat ----

interface ChatParams {
  studentId: string;
  courseId: string;
  question: string;
  history: ChatMessage[];
  pageContext?: import("./types").PageContext | null;
}

function chatBody(params: ChatParams): string {
  return JSON.stringify({
    student_id: params.studentId,
    course_id: params.courseId,
    question: params.question,
    history: params.history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    page_context: params.pageContext || undefined,
  });
}

export async function sendChat(
  params: ChatParams,
): Promise<{ message?: string; rag?: import("./types").RAGContext }> {
  return apiFetch<{ message?: string; rag?: import("./types").RAGContext }>(
    "/edu/chat",
    {
      method: "POST",
      headers: jsonHeaders,
      body: chatBody(params),
    },
  );
}

/**
 * 流式对话（SSE）：每收到一段增量文本回调 onDelta，最终 resolve 完整响应。
 * 后端事件序列：delta*（{content}）→ done（完整 ChatResponse）；error 事件转为 reject。
 */
export async function sendChatStream(
  params: ChatParams,
  onDelta: (text: string) => void,
): Promise<{ message?: string; rag?: import("./types").RAGContext }> {
  const token = getToken();
  const headers: Record<string, string> = { ...jsonHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/edu/chat/stream`, {
    method: "POST",
    headers,
    body: chatBody(params),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    let err = "";
    try {
      const errObj = (await res.json()) as { error?: string; message?: string };
      err = errObj.error || errObj.message || "";
    } catch {
      err = await res.text().catch(() => "");
    }
    throw new Error(err || "Request failed");
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    // 后端在传输层不支持 flush 时会退回整段 JSON
    return (await res.json()) as {
      message?: string;
      rag?: import("./types").RAGContext;
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let done: { message?: string; rag?: import("./types").RAGContext } | null =
    null;

  const handleLine = (line: string) => {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      return;
    }
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trim();
    if (!raw) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (eventName === "delta" && typeof payload.content === "string") {
      if (payload.content) onDelta(payload.content);
    } else if (eventName === "done") {
      done = payload as { message?: string; rag?: import("./types").RAGContext };
    } else if (eventName === "error") {
      throw new Error(
        (typeof payload.error === "string" && payload.error) || "对话失败",
      );
    }
  };

  for (;;) {
    const { value, done: eof } = await reader.read();
    if (eof) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      handleLine(line);
    }
  }
  if (buffer.trim()) handleLine(buffer.trim());
  if (!done) throw new Error("流式响应意外中断");
  return done;
}

export async function autoCreateHomework(params: {
  courseId: string;
  classId: string;
  lessonContent: string;
  teacherGoal: string;
  title?: string;
  publish?: boolean;
}): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>("/edu/homework/auto", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      course_id: params.courseId,
      class_id: params.classId,
      lesson_content: params.lessonContent,
      teacher_goal: params.teacherGoal,
      title: params.title,
      publish: params.publish ?? true,
    }),
  });
}

export async function sendAgentCommand(params: {
  message: string;
  context?: string;
  history: AgentTurn[];
}): Promise<AgentDirective> {
  return apiFetch<AgentDirective>("/edu/agent/command", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      message: params.message,
      context: params.context,
      history: params.history.slice(-6),
    }),
  });
}

// ---- Conversations (对话历史，后端持久化) ----

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await apiFetch<{ items?: ConversationSummary[] }>(
    "/edu/conversations",
  );
  return res.items ?? [];
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/edu/conversations/${encodeURIComponent(id)}`,
  );
}

export async function saveConversation(
  req: SaveConversationRequest,
): Promise<Conversation> {
  return apiFetch<Conversation>("/edu/conversations", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`/edu/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---- Homework ----

export async function createHomework(draft: HomeworkDraft): Promise<HomeworkTask> {
  const steps = draft.steps.filter(
    (s) => s.title.trim() || s.instruction.trim() || s.expected.trim(),
  );
  return apiFetch<HomeworkTask>("/edu/homework", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      title: draft.title,
      prompt: draft.prompt,
      class_id: draft.class_id,
      course_id: draft.course_id,
      lesson_id: draft.lesson_id || undefined,
      steps: steps.length > 0 ? steps : undefined,
      published: draft.published,
    }),
  });
}

export async function submitHomework(params: {
  homeworkId: string;
  studentId: string;
  stepIndex: number;
  answer: string;
}): Promise<void> {
  await apiFetch("/edu/homework/submit", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      homework_id: params.homeworkId,
      student_id: params.studentId,
      step_index: params.stepIndex,
      answer: params.answer,
    }),
  });
}

// ─── 代码审查 (Code Review) — 第 5 个 Agent ──────────────────────────────

/** 提交代码审查（POST /edu/code-review）。返回 0-100 分 + 问题清单 + 苏格拉底式提示。 */
export async function codeReview(req: CodeReviewRequest): Promise<CodeReviewResult> {
  return apiFetch<CodeReviewResult>("/edu/code-review", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(req),
  });
}

/** 列出后端已注册的语言（前端下拉框用）。 */
export async function listCodeReviewLanguages(): Promise<string[]> {
  const res = await apiFetch<CodeReviewLanguagesResponse>("/edu/code-review/languages");
  return res.languages;
}
