package edu_service

import (
	"context"
	"errors"
	"time"
)

type KnowledgeAnalysis struct {
	Concepts     []string `json:"concepts"`
	Difficulties []string `json:"difficulties"`
	LearningPath []string `json:"learning_path"`
}

type RetrievalHit struct {
	LessonID string   `json:"lesson_id"`
	CourseID string   `json:"course_id"`
	Title    string   `json:"title"`
	Snippet  string   `json:"snippet"`
	Concepts []string `json:"concepts"`
	Score    int      `json:"score"`
}

type RAGContext struct {
	Query       string         `json:"query"`
	IndexStatus string         `json:"index_status"`
	Hits        []RetrievalHit `json:"hits"`
}

type RetrievalIndexStats struct {
	Status       string `json:"status"`
	IndexedCount int    `json:"indexed_count"`
}

// SearchRequest 供教师/超管试跑检索（完善 RAG 可观测性）。
type SearchRequest struct {
	Query    string `json:"query"`
	CourseID string `json:"course_id"`
	Limit    int    `json:"limit"`
}

type SearchResponse struct {
	Query       string               `json:"query"`
	CourseID    string               `json:"course_id,omitempty"`
	IndexStatus string               `json:"index_status"`
	IndexedCount int                 `json:"indexed_count"`
	Hits        []RetrievalHit       `json:"hits"`
	Terms       []string             `json:"terms,omitempty"`
}

type StudentMemory struct {
	KnowledgeWeakness  []string `json:"knowledge_weakness"`
	CommonErrors       []string `json:"common_errors"`
	ThinkingStyle      string   `json:"thinking_style"`
	ReflectionLevel    int      `json:"reflection_level"`
	UnderstandingScore int      `json:"understanding_score"`
	TrustScore         int      `json:"trust_score"`
	UpdatedAt          string   `json:"updated_at"`
}

type Evaluation struct {
	UnderstandingScore int      `json:"understanding_score"`
	ReallyUnderstood   bool     `json:"really_understood"`
	ErrorTypes         []string `json:"error_types"`
	ThinkingDepth      int      `json:"thinking_depth"`
	ReflectionLevel    int      `json:"reflection_level"`
	QuestionQuality    int      `json:"question_quality"`
	ExplanationQuality int      `json:"explanation_quality"`
	ReflectionDepth    int      `json:"reflection_depth"`
}

type TrustPolicy struct {
	Score       int    `json:"score"`
	Level       string `json:"level"`
	Permission  string `json:"permission"`
	CanHint     bool   `json:"can_hint"`
	CanPartial  bool   `json:"can_partial"`
	CanExplain  bool   `json:"can_explain"`
	Description string `json:"description"`
}

type AnalyzeRequest struct {
	CourseID string `json:"course_id"`
	LessonID string `json:"lesson_id"`
	Content  string `json:"content"`
	FileURL  string `json:"file_url"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// PageContext 当前屏幕上下文（Chrome Gemini 式：教练能“看见”学生正在看的页面）。
// 由前端从作业台/课程页注入，不爬外网。
type PageContext struct {
	Scene          string `json:"scene,omitempty"`           // homework_step | free_chat | lesson
	Title          string `json:"title,omitempty"`           // 作业/课程标题
	StepTitle      string `json:"step_title,omitempty"`      // 当前阶段名
	StepIndex      int    `json:"step_index,omitempty"`      // 0-based
	StepTotal      int    `json:"step_total,omitempty"`
	Instruction    string `json:"instruction,omitempty"`     // 题干/要求
	ExpectedHint   string `json:"expected_hint,omitempty"`   // 阶段期望（教练可见，不向学生直接复述成答案）
	StudentDraft   string `json:"student_draft,omitempty"`   // 学生正在写的草稿
	CourseName     string `json:"course_name,omitempty"`
	HomeworkID     string `json:"homework_id,omitempty"`
	LessonID       string `json:"lesson_id,omitempty"`
	VisibleSummary string `json:"visible_summary,omitempty"` // 可选：页面可见摘要
}

type ChatRequest struct {
	StudentID   string            `json:"student_id"`
	CourseID    string            `json:"course_id"`
	Question    string            `json:"question"`
	History     []ChatMessage     `json:"history"`
	Context     KnowledgeAnalysis `json:"context"`
	Retrieval   []RetrievalHit    `json:"retrieval,omitempty"`
	PageContext *PageContext      `json:"page_context,omitempty"`
}

type EvaluateRequest struct {
	StudentID string `json:"student_id"`
	CourseID  string `json:"course_id"`
	Answer    string `json:"answer"`
	Question  string `json:"question"`
}

type ReportRequest struct {
	StudentID string `json:"student_id"`
	CourseID  string `json:"course_id"`
	ClassID   string `json:"class_id"`
}

type WorkflowRequest struct {
	StudentID     string `json:"student_id"`
	CourseID      string `json:"course_id"`
	ClassID       string `json:"class_id"`
	LessonContent string `json:"lesson_content"`
	StudentInput  string `json:"student_input"`
	StudentAnswer string `json:"student_answer"`
}

type ChatResponse struct {
	Agent      string        `json:"agent"`
	Message    string        `json:"message"`
	Trust      TrustPolicy   `json:"trust"`
	Memory     StudentMemory `json:"memory"`
	PromptUsed string        `json:"prompt_used"`
	RAG        RAGContext    `json:"rag"`
}

type Report struct {
	Scope          string         `json:"scope"`
	StudentID      string         `json:"student_id,omitempty"`
	ClassID        string         `json:"class_id,omitempty"`
	Memory         *StudentMemory `json:"memory,omitempty"`
	CommonProblems []string       `json:"common_problems"`
	Suggestions    []string       `json:"suggestions"`
	Strategies     []string       `json:"strategies"`
	GeneratedAt    string         `json:"generated_at"`
	PromptUsed     string         `json:"prompt_used"`
}

type WorkflowResponse struct {
	Knowledge  KnowledgeAnalysis `json:"knowledge"`
	Tutor      ChatResponse      `json:"tutor"`
	Evaluation Evaluation        `json:"evaluation"`
	Memory     StudentMemory     `json:"memory"`
	Report     Report            `json:"report"`
	RAG        RAGContext        `json:"rag"`
	Session    *LearningSession  `json:"session,omitempty"`
}

type LLMConfig struct {
	BaseURL   string `json:"base_url"`
	APIKey    string `json:"api_key,omitempty"`
	Model     string `json:"model,omitempty"`
	Enabled   bool   `json:"enabled"`
	UpdatedAt string `json:"updated_at"`
}

type AgentChatRequest struct {
	Mode     string `json:"mode"`
	Message  string `json:"message"`
	Context  string `json:"context"`
	CourseID string `json:"course_id"`
}

type AgentChatResponse struct {
	Mode       string `json:"mode"`
	Message    string `json:"message"`
	PromptUsed string `json:"prompt_used"`
	LLMStatus  string `json:"llm_status"`
}

type HomeworkStep struct {
	Index       int    `json:"index"`
	Title       string `json:"title"`
	Instruction string `json:"instruction"`
	Expected    string `json:"expected"`
}

type HomeworkTask struct {
	ID          string         `json:"id"`
	CourseID    string         `json:"course_id"`
	ClassID     string         `json:"class_id"`
	LessonID    string         `json:"lesson_id"`
	Title       string         `json:"title"`
	Prompt      string         `json:"prompt"`
	Steps       []HomeworkStep `json:"steps"`
	Published   bool           `json:"published"`
	Archived    bool           `json:"archived"`
	CreatedBy   string         `json:"created_by"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
	PublishedAt string         `json:"published_at,omitempty"`
}

type HomeworkAttempt struct {
	ID                 string     `json:"id"`
	HomeworkID         string     `json:"homework_id"`
	StudentID          string     `json:"student_id"`
	StepIndex          int        `json:"step_index"`
	Answer             string     `json:"answer"`
	Guidance           string     `json:"guidance"`
	Evaluation         Evaluation `json:"evaluation"`
	TrustScore         int        `json:"trust_score"`
	UnlockedPermission string     `json:"unlocked_permission"`
	CompletedStep      bool       `json:"completed_step"`
	CompletedHomework  bool       `json:"completed_homework"`
	NextRequiredAction string     `json:"next_required_action"`
	CreatedAt          string     `json:"created_at"`
}

type CreateHomeworkRequest struct {
	ID        string         `json:"id"`
	CourseID  string         `json:"course_id"`
	ClassID   string         `json:"class_id"`
	LessonID  string         `json:"lesson_id"`
	Title     string         `json:"title"`
	Prompt    string         `json:"prompt"`
	Steps     []HomeworkStep `json:"steps"`
	Published *bool          `json:"published"`
	Archived  *bool          `json:"archived"`
}

type SubmitHomeworkRequest struct {
	HomeworkID string `json:"homework_id"`
	StudentID  string `json:"student_id"`
	StepIndex  int    `json:"step_index"`
	Answer     string `json:"answer"`
}

type ResetHomeworkAttemptsRequest struct {
	StudentID string `json:"student_id"`
}

type ResetHomeworkAttemptsResponse struct {
	HomeworkID string `json:"homework_id"`
	StudentID  string `json:"student_id,omitempty"`
	Deleted    int    `json:"deleted"`
}

type AutoHomeworkRequest struct {
	CourseID      string `json:"course_id"`
	ClassID       string `json:"class_id"`
	LessonID      string `json:"lesson_id"`
	Title         string `json:"title"`
	LessonContent string `json:"lesson_content"`
	TeacherGoal   string `json:"teacher_goal"`
	Publish       *bool  `json:"publish"`
}

type AutoHomeworkResponse struct {
	Lesson   Lesson            `json:"lesson"`
	Homework HomeworkTask      `json:"homework"`
	Analysis KnowledgeAnalysis `json:"analysis"`
	Message  string            `json:"message"`
}

type LessonImportRecord struct {
	FileName      string `json:"file_name"`
	Title         string `json:"title"`
	LessonID      string `json:"lesson_id"`
	ContentLength int    `json:"content_length"`
	Kind          string `json:"kind,omitempty"`           // lesson | homework | outline | unknown
	KindLabel     string `json:"kind_label,omitempty"`     // 中文标签
	Confidence    int    `json:"confidence,omitempty"`     // 0-100
	Reason        string `json:"reason,omitempty"`         // 入库理由
	Concepts      []string `json:"concepts,omitempty"`     // TeacherAgent 解析到的概念（便于导入报告展示）
}

type LessonImportSkip struct {
	FileName   string `json:"file_name"`
	Reason     string `json:"reason"`
	Kind       string `json:"kind,omitempty"`
	KindLabel  string `json:"kind_label,omitempty"`
	Confidence int    `json:"confidence,omitempty"`
}

// ImportIntentSummary Agent 对整次上传的意图判断（展示用）。
type ImportIntentSummary struct {
	Intent string `json:"intent"` // ingest_lessons | build_homework | mixed_materials | mostly_noise
	Label  string `json:"label"`
	Summary string `json:"summary"`
}

type LessonUploadResponse struct {
	Items    []Lesson              `json:"items"`
	Imported []LessonImportRecord  `json:"imported"`
	Skipped  []LessonImportSkip    `json:"skipped"`
	Total    int                   `json:"total"`
	Message  string                `json:"message"`
	Intent   *ImportIntentSummary  `json:"intent,omitempty"`
	// 统计：视频与 UI 一眼能看懂
	Stats struct {
		Accepted int `json:"accepted"`
		Skipped  int `json:"skipped"`
		Lessons  int `json:"lessons"`
		Homework int `json:"homework"`
		Noise    int `json:"noise"`
	} `json:"stats"`
}

type GuidedHomeworkResponse struct {
	Homework HomeworkTask    `json:"homework"`
	Attempt  HomeworkAttempt `json:"attempt"`
	Trust    TrustPolicy     `json:"trust"`
	NextStep *HomeworkStep   `json:"next_step,omitempty"`
	Message  string          `json:"message"`
	Memory   StudentMemory   `json:"memory"`
}

type ListQuery struct {
	Page     int
	PageSize int
	Keyword  string
	Role     string
	ClassID  string
	Archived *bool
}

type PageInfo struct {
	Page     int  `json:"page"`
	PageSize int  `json:"page_size"`
	Total    int  `json:"total"`
	HasNext  bool `json:"has_next"`
	HasPrev  bool `json:"has_prev"`
}

type PagedResponse[T any] struct {
	Items []T `json:"items"`
	PageInfo
}

// School 学校/组织层级：班级与用户通过 school_id 归属到某个学校。
type School struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type Class struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Grade     string `json:"grade"`
	TeacherID string `json:"teacher_id"`
	SchoolID  string `json:"school_id,omitempty"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type Student struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ClassID   string `json:"class_id"`
	UserID    string `json:"user_id,omitempty"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// StudentDetailResponse 是 GET /edu/students/{id} 的详情响应：
// 在裸 Student 之上拼上认知记忆（信任分/弱点/思维风格）与该生学习轨迹，
// 供前端画像面板复用。Memory 为空（学生尚无学习数据）时置 nil。
type StudentDetailResponse struct {
	Student
	Memory   *StudentMemory    `json:"memory,omitempty"`
	Sessions []LearningSession `json:"sessions"`
}

type Course struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ClassID   string `json:"class_id"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type Lesson struct {
	ID           string            `json:"id"`
	CourseID     string            `json:"course_id"`
	Title        string            `json:"title"`
	Content      string            `json:"content"`
	FileName     string            `json:"file_name"`
	Analysis     KnowledgeAnalysis `json:"analysis"`
	AnalysisDone bool              `json:"analysis_done"`
	Archived     bool              `json:"archived"`
	CreatedAt    string            `json:"created_at"`
	UpdatedAt    string            `json:"updated_at"`
}

type LearningSession struct {
	ID         string            `json:"id"`
	StudentID  string            `json:"student_id"`
	CourseID   string            `json:"course_id"`
	ClassID    string            `json:"class_id"`
	LessonID   string            `json:"lesson_id"`
	Input      string            `json:"input"`
	Answer     string            `json:"answer"`
	Knowledge  KnowledgeAnalysis `json:"knowledge"`
	Evaluation Evaluation        `json:"evaluation"`
	TrustScore int               `json:"trust_score"`
	CreatedAt  string            `json:"created_at"`
}

type AuditLog struct {
	ID        string `json:"id"`
	ActorID   string `json:"actor_id"`
	Action    string `json:"action"`
	Target    string `json:"target"`
	Detail    string `json:"detail"`
	CreatedAt string `json:"created_at"`
}

type Dashboard struct {
	Schools           []School            `json:"schools"`
	Classes           []Class             `json:"classes"`
	Students          []Student           `json:"students"`
	Courses           []Course            `json:"courses"`
	Lessons           []Lesson            `json:"lessons"`
	Homeworks         []HomeworkTask      `json:"homeworks"`
	HomeworkAttempts  []HomeworkAttempt   `json:"homework_attempts"`
	Sessions          []LearningSession   `json:"sessions"`
	AuditLogs         []AuditLog          `json:"audit_logs"`
	Users             []User              `json:"users"`
	AverageTrust      int                 `json:"average_trust"`
	AverageUnderstand int                 `json:"average_understanding"`
	CommonProblems    []string            `json:"common_problems"`
	RetrievalIndex    RetrievalIndexStats `json:"retrieval_index"`
	StudentMemory     *StudentMemory      `json:"student_memory,omitempty"`
}

type User struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	Name          string   `json:"name"`
	Role          string   `json:"role"`
	ClassIDs      []string `json:"class_ids"`
	StudentID     string   `json:"student_id,omitempty"`
	SchoolID      string   `json:"school_id,omitempty"`
	Active        bool     `json:"active"`
	PasswordHash  string   `json:"password_hash,omitempty"`
	AvatarURL     string   `json:"avatar_url,omitempty"`
	BackgroundURL string   `json:"background_url,omitempty"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

type AuthSession struct {
	Token     string `json:"token"`
	UserID    string `json:"user_id"`
	ExpiresAt string `json:"expires_at"`
	CreatedAt string `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string `json:"token"`
	User      User   `json:"user"`
	ExpiresAt string `json:"expires_at"`
}

type CreateUserRequest struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Password  string   `json:"password"`
	Name      string   `json:"name"`
	Role      string   `json:"role"`
	ClassIDs  []string `json:"class_ids"`
	StudentID string   `json:"student_id"`
	SchoolID  string   `json:"school_id"`
	Active    *bool    `json:"active"`
}

type UpdateUserRequest struct {
	ID        string   `json:"id"`
	Password  string   `json:"password"`
	Name      string   `json:"name"`
	Role      string   `json:"role"`
	ClassIDs  []string `json:"class_ids"`
	StudentID string   `json:"student_id"`
	SchoolID  string   `json:"school_id"`
	Active    *bool    `json:"active"`
}

// CreateSchoolRequest 学校 upsert：有 id 更新，无 id 新建。
type CreateSchoolRequest struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Code     string `json:"code"`
	Archived *bool  `json:"archived"`
}

// SchoolResponse 在学校数据上附带操作提示（如归档时仍有未归档班级）。
type SchoolResponse struct {
	School
	Message string `json:"message,omitempty"`
}

// ImportStudentRow 批量导入学生的单行：姓名必填，create_user 时用户名重复则该行失败。
type ImportStudentRow struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type ImportStudentsRequest struct {
	ClassID    string             `json:"class_id"`
	CreateUser bool               `json:"create_user"`
	Rows       []ImportStudentRow `json:"rows"`
}

type ImportStudentsResponse struct {
	Created int       `json:"created"`
	Failed  int       `json:"failed"`
	Errors  []string  `json:"errors"`
	Items   []Student `json:"items"`
}

type CreateClassRequest struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Grade     string `json:"grade"`
	TeacherID string `json:"teacher_id"`
	SchoolID  string `json:"school_id"`
	Archived  *bool  `json:"archived"`
}

type CreateStudentRequest struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ClassID    string `json:"class_id"`
	UserID     string `json:"user_id"`
	Archived   *bool  `json:"archived"`
	CreateUser bool   `json:"create_user"`
	Username   string `json:"username"`
	Password   string `json:"password"`
}

type CreateCourseRequest struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ClassID  string `json:"class_id"`
	Archived *bool  `json:"archived"`
}

type CreateLessonRequest struct {
	ID       string `json:"id"`
	CourseID string `json:"course_id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	Archived *bool  `json:"archived"`
}

type AgentWriteRequest struct {
	Target   string `json:"target"`
	ClassID  string `json:"class_id"`
	CourseID string `json:"course_id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	Prompt   string `json:"prompt"`
}

type AgentWriteResponse struct {
	Target   string            `json:"target"`
	Lesson   *Lesson           `json:"lesson,omitempty"`
	Course   *Course           `json:"course,omitempty"`
	Analysis KnowledgeAnalysis `json:"analysis,omitempty"`
	Message  string            `json:"message"`
}

type AgentTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AgentCommandRequest struct {
	Message string      `json:"message"`
	Context string      `json:"context,omitempty"`
	History []AgentTurn `json:"history,omitempty"`
}

type AgentMetric struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type AgentCard struct {
	Type    string            `json:"type"`
	Title   string            `json:"title"`
	Body    string            `json:"body,omitempty"`
	Fields  map[string]string `json:"fields,omitempty"`
	Items   []string          `json:"items,omitempty"`
	Metrics []AgentMetric     `json:"metrics,omitempty"`
}

type AgentChoice struct {
	Label   string            `json:"label"`
	Action  string            `json:"action"`
	Payload map[string]string `json:"payload,omitempty"`
	Style   string            `json:"style,omitempty"`
}

type AgentDirective struct {
	Reply     string        `json:"reply"`
	Intent    string        `json:"intent"`
	Cards     []AgentCard   `json:"cards,omitempty"`
	Choices   []AgentChoice `json:"choices,omitempty"`
	LLMStatus string        `json:"llm_status"`
}

// ConversationMessage 是一条会话消息：user 存文本，agent 存整个 directive
// （足以在前端重建气泡：回复文本 + 卡片 + 操作按钮）。
type ConversationMessage struct {
	Role      string          `json:"role"` // "user" | "agent"
	Text      string          `json:"text,omitempty"`
	Directive *AgentDirective `json:"directive,omitempty"`
	CreatedAt string          `json:"created_at,omitempty"`
}

// Conversation 是一段可持久化、可回看的对话历史，按 OwnerID 归属隔离。
type Conversation struct {
	ID        string                `json:"id"`
	OwnerID   string                `json:"owner_id"`
	Title     string                `json:"title"`
	Mode      string                `json:"mode"` // "admin" | "teacher"
	Messages  []ConversationMessage `json:"messages"`
	CreatedAt string                `json:"created_at"`
	UpdatedAt string                `json:"updated_at"`
}

// SaveConversationRequest 是 upsert 请求：ID 为空则新建，非空则更新同属主会话。
type SaveConversationRequest struct {
	ID       string                `json:"id"`
	Title    string                `json:"title"`
	Mode     string                `json:"mode"`
	Messages []ConversationMessage `json:"messages"`
}

// ─────────────────────────────────────────────────────────────────────────────
// 代码审查 (Code Review) — 第 5 个 Agent，用于「教学辅助 / 代码审查 / 个性化学习」三大场景
// 之一：学生提交代码（SQL / Python / 可扩展），在不直接给出修正后代码的前提下指出
// 语法、风格、逻辑问题，配合信任分门控提供渐进式提示。
// ─────────────────────────────────────────────────────────────────────────────

// CodeReviewRequest 是代码审查请求。
// Code 与 Language 必填；Question 是题目背景；Schema 是 SQL 专用（DDL，建表语句）；
// Context 是其他补充信息（教师期望、参考查询等）。
type CodeReviewRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"` // "sql" | "python" | (extensible)
	Question string `json:"question,omitempty"`
	Schema   string `json:"schema,omitempty"`   // SQL: 可选 DDL，建在沙盒里
	Context  string `json:"context,omitempty"`  // 任意补充上下文（教师期望 / 参考查询等）
}

// CodeIssue 是单条审查问题。Severity / Type 用于前端分类着色与排序；Suggestion 是
// 苏格拉底式「提示方向」，不是「直接给答案」（与 TutorAgent.enforceQuestionOnly 原则一致）。
type CodeIssue struct {
	Severity   string `json:"severity"`         // "error" | "warning" | "info"
	Line       int    `json:"line"`             // 1-based；0 = 整体
	Type       string `json:"type"`             // "syntax" | "style" | "logic" | "performance" | "security" | "best_practice"
	Message    string `json:"message"`          // 直接可读的问题描述
	Suggestion string `json:"suggestion"`       // 渐进式提示（不泄题）
}

// CodeReviewResult 是审查结果。
// SyntaxOK / ExecutedOK 是技术状态（SQL 用 ExecutedOK；Python 只能 StaticCheckOK）。
// Score 是 0–100 的综合质量分；Summary / Suggestion 是给学生的渐进式反馈；
// LLMStatus 表明是否走 LLM 增强（用于前端展示「AI 深度分析中 / 启发式结果」）。
type CodeReviewResult struct {
	Language      string      `json:"language"`
	SyntaxOK      bool        `json:"syntax_ok"`
	ExecutedOK    bool        `json:"executed_ok"`
	StaticCheckOK bool        `json:"static_check_ok"`
	Score         int         `json:"score"`
	Issues        []CodeIssue `json:"issues"`
	Summary       string      `json:"summary"`      // 一句话总评
	Suggestion    string      `json:"suggestion"`   // 苏格拉底式提示（不泄题）
	LLMStatus     string      `json:"llm_status"`   // "llm_enhanced" | "heuristic_only" | "llm_failed_fallback"
	ReviewedAt    string      `json:"reviewed_at"`
}

// CodeReviewer 是可扩展语言适配器接口。新增语言只需实现该接口并通过
// RegisterCodeReviewer 注册；Service 端无需改动（见 code_review.go）。
type CodeReviewer interface {
	Language() string
	Review(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error)
}

// CodeReviewerFunc 是函数式适配器：把 Language()/Review() 两个方法打包成一个 struct，
// 方便测试和动态注册时不用每次都写一个新类型。
type CodeReviewerFunc struct {
	Lang string
	Fn   func(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error)
}

func (f CodeReviewerFunc) Language() string { return f.Lang }
func (f CodeReviewerFunc) Review(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error) {
	if f.Fn == nil {
		return CodeReviewResult{}, errors.New("reviewer not implemented")
	}
	return f.Fn(ctx, req)
}

func nowString() string {
	return time.Now().Format(time.RFC3339)
}
