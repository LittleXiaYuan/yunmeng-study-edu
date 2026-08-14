export interface Knowledge {
  concepts: string[];
  difficulties: string[];
  learning_path: string[];
}

/** 检索命中（与后端 RetrievalHit 对齐） */
export interface RetrievalHit {
  lesson_id: string;
  course_id: string;
  title: string;
  snippet: string;
  concepts: string[];
  score: number;
}

export interface RetrievalIndexStats {
  status: string;
  indexed_count: number;
}

/** 智能导入：单条采纳 */
export interface LessonImportRecord {
  file_name: string;
  title: string;
  lesson_id: string;
  content_length: number;
  kind?: string;
  kind_label?: string;
  confidence?: number;
  reason?: string;
  concepts?: string[];
}

/** 智能导入：跳过/噪声 */
export interface LessonImportSkip {
  file_name: string;
  reason: string;
  kind?: string;
  kind_label?: string;
  confidence?: number;
}

export interface ImportIntentSummary {
  intent: string;
  label: string;
  summary: string;
}

export interface LessonUploadResponse {
  items?: Lesson[];
  imported?: LessonImportRecord[];
  skipped?: LessonImportSkip[];
  total?: number;
  message?: string;
  intent?: ImportIntentSummary;
  stats?: {
    accepted: number;
    skipped: number;
    lessons: number;
    homework: number;
    noise: number;
  };
}

export interface RAGContext {
  query: string;
  index_status: string;
  hits: RetrievalHit[];
}

/** 当前屏幕上下文（教练“看见”学生正在做的页，类似 Chrome Gemini） */
export interface PageContext {
  scene?: string;
  title?: string;
  step_title?: string;
  step_index?: number;
  step_total?: number;
  instruction?: string;
  expected_hint?: string;
  student_draft?: string;
  course_name?: string;
  homework_id?: string;
  lesson_id?: string;
  visible_summary?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: string;
  teacher_id: string;
  school_id?: string;
  archived: boolean;
}

/** 学校/组织（超管组织后台） */
export interface School {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Course {
  id: string;
  name: string;
  class_id: string;
  archived: boolean;
}

export interface Student {
  id: string;
  name: string;
  class_id: string;
  archived: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

/** 名单面板行数据（等价于后端 Student，字段全量）。 */
export type StudentListItem = Student;

/**
 * 学生详情：裸 Student + 认知记忆 + 学习轨迹。
 * memory 为 null/缺省表示该生尚无真实学习数据（前端显示占位）。
 */
export interface StudentDetail extends Student {
  memory?: StudentMemory | null;
  sessions?: Session[];
}

/** 后端分页响应通用形状（PagedResponse[T]）。 */
export interface Paged<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  class_ids: string[];
  student_id?: string;
  school_id?: string;
  avatar_url?: string;
  background_url?: string;
}

export interface Lesson {
  id: string;
  title: string;
  course_id: string;
  content: string;
  file_name: string;
  analysis: Knowledge;
  analysis_done?: boolean;
  archived: boolean;
  created_at?: string;
  updated_at: string;
}

export interface HomeworkStep {
  index: number;
  title: string;
  instruction: string;
  expected: string;
}

export interface HomeworkTask {
  id: string;
  course_id: string;
  class_id: string;
  lesson_id?: string;
  title: string;
  prompt: string;
  steps?: HomeworkStep[];
  published: boolean;
  archived: boolean;
}

export interface HomeworkAttempt {
  id: string;
  homework_id: string;
  student_id: string;
  step_index: number;
  answer: string;
  guidance: string;
  trust_score: number;
  completed_step: boolean;
  completed_homework: boolean;
  next_required_action: string;
  created_at: string;
}

export interface Session {
  id: string;
  student_id: string;
  input: string;
  answer: string;
  trust_score: number;
  evaluation: {
    understanding_score: number;
    error_types: string[];
  };
  created_at: string;
}

export interface StudentMemory {
  knowledge_weakness: string[];
  common_errors: string[];
  thinking_style: string;
  reflection_level: number;
  understanding_score: number;
  trust_score: number;
  updated_at: string;
}

export interface Dashboard {
  classes: ClassItem[];
  courses: Course[];
  students: Student[];
  lessons: Lesson[];
  homeworks: HomeworkTask[];
  homework_attempts?: HomeworkAttempt[];
  sessions: Session[];
  schools?: School[];
  average_trust: number;
  average_understanding: number;
  common_problems: string[];
  retrieval_index: {
    status: string;
    indexed_count: number;
  };
  student_memory?: StudentMemory;
}

export interface AgentChatResponse {
  mode: string;
  message: string;
  llm_status: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  rag?: RAGContext;
  score?: number;
  issues?: string[];
  variant?: "welcome";
  /** 流式接收中：内容还在增量追加（渲染打字光标 / 等待点） */
  streaming?: boolean;
}

export interface LLMConfig {
  base_url: string;
  api_key?: string;
  model?: string;
  enabled: boolean;
  updated_at?: string;
}

export interface TaskDraft {
  title: string;
  teacher_goal: string;
  class_id: string;
  course_id: string;
  lesson_id: string;
  publish: boolean;
}

export interface HomeworkStepDraft {
  title: string;
  instruction: string;
  expected: string;
}

export interface HomeworkDraft {
  title: string;
  prompt: string;
  class_id: string;
  course_id: string;
  lesson_id: string;
  steps: HomeworkStepDraft[];
  published: boolean;
}

export type Role = "admin" | "teacher" | "student";

export interface AgentTurn {
  role: string;
  content: string;
}

export interface AgentMetric {
  label: string;
  value: string;
}

export interface AgentCard {
  type: "info" | "form_prefill" | "data" | "analysis" | "confirm" | string;
  title: string;
  body?: string;
  fields?: Record<string, string>;
  items?: string[];
  metrics?: AgentMetric[];
}

export interface AgentChoice {
  label: string;
  action: string;
  payload?: Record<string, string>;
  style?: "primary" | "secondary" | "danger" | string;
}

export interface AgentDirective {
  reply: string;
  intent: string;
  cards?: AgentCard[];
  choices?: AgentChoice[];
  llm_status: string;
}

/** 一条会话消息：user 存 text，agent 存整个 directive（用于重建气泡）。 */
export interface ConversationMessage {
  role: "user" | "agent";
  text?: string;
  directive?: AgentDirective;
  created_at?: string;
}

/** 完整会话（含消息），GET /edu/conversations/{id} 返回。 */
export interface Conversation {
  id: string;
  owner_id?: string;
  title: string;
  mode: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

/** 会话摘要（不含消息），GET /edu/conversations 列表返回。 */
export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  message_count: number;
  updated_at: string;
  created_at: string;
}

/** upsert 请求：id 空则新建。 */
export interface SaveConversationRequest {
  id?: string;
  title: string;
  mode: string;
  messages: ConversationMessage[];
}

export interface ClassDraft {
  name: string;
  grade: string;
  teacher_id: string;
}

export interface CourseDraft {
  name: string;
  class_id: string;
}

export interface StudentDraft {
  name: string;
  class_id: string;
  username: string;
  password: string;
  create_user: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 代码审查 (Code Review) — 与后端 CodeReviewRequest/Result/Issue 对齐
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeReviewRequest {
  code: string;
  language: string; // "sql" | "python" | (extensible)
  question?: string;
  schema?: string;  // SQL 专用：DDL，建在沙盒里
  context?: string;
}

export type CodeIssueSeverity = "error" | "warning" | "info";
export type CodeIssueType =
  | "syntax"
  | "style"
  | "logic"
  | "performance"
  | "security"
  | "best_practice";

export interface CodeIssue {
  severity: CodeIssueSeverity;
  line: number;
  type: CodeIssueType;
  message: string;
  suggestion: string;
}

export interface CodeReviewResult {
  language: string;
  syntax_ok: boolean;
  executed_ok: boolean;
  static_check_ok: boolean;
  score: number; // 0-100
  issues: CodeIssue[];
  summary: string;
  suggestion: string; // 苏格拉底式提示（不直接给答案）
  llm_status: "llm_enhanced" | "heuristic_only" | "llm_failed_fallback";
  reviewed_at: string;
}

export interface CodeReviewLanguagesResponse {
  languages: string[];
}
