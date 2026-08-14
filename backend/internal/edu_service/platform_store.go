package edu_service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type PlatformState struct {
	Schools       []School          `json:"schools"`
	Classes       []Class           `json:"classes"`
	Students      []Student         `json:"students"`
	Courses       []Course          `json:"courses"`
	Lessons       []Lesson          `json:"lessons"`
	Homeworks     []HomeworkTask    `json:"homeworks"`
	Attempts      []HomeworkAttempt `json:"homework_attempts"`
	Sessions      []LearningSession `json:"sessions"`
	Audit         []AuditLog        `json:"audit"`
	Users         []User            `json:"users"`
	AuthSessions  []AuthSession     `json:"auth_sessions"`
	LLMConfig     LLMConfig         `json:"llm_config"`
	Conversations []Conversation    `json:"conversations"`
}

type PlatformStore struct {
	path string
	mu   sync.Mutex
}

func NewPlatformStore(dir string) (*PlatformStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	store := &PlatformStore{path: filepath.Join(dir, "platform_state.json")}
	if _, err := os.Stat(store.path); os.IsNotExist(err) {
		return store, store.saveLocked(seedState())
	}
	return store, nil
}

func (s *PlatformStore) State() (PlatformState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadLocked()
}

func (s *PlatformStore) Login(username string, password string) (LoginResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return LoginResponse{}, err
	}
	return loginInState(state, username, password, s.saveStateLocked)
}

func (s *PlatformStore) UserByToken(token string) (User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return User{}, false
	}
	return userByTokenInState(state, token)
}

func (s *PlatformStore) ListUsers() ([]User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return nil, err
	}
	return state.Users, nil
}

func (s *PlatformStore) LLMConfig() (LLMConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return LLMConfig{}, err
	}
	return state.LLMConfig, nil
}

func (s *PlatformStore) UpdateLLMConfig(config LLMConfig, actorID string) (LLMConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return LLMConfig{}, err
	}
	return updateLLMConfigInState(state, config, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertUser(req CreateUserRequest, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return User{}, err
	}
	return upsertUserInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpdateUser(req UpdateUserRequest, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return User{}, err
	}
	return updateUserInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpdateUserImage(userID string, kind string, url string, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return User{}, err
	}
	return updateUserImageInState(state, userID, kind, url, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertClass(req CreateClassRequest, actorID string) (Class, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Class{}, err
	}
	return upsertClassInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertSchool(req CreateSchoolRequest, actorID string) (School, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return School{}, err
	}
	return upsertSchoolInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) AppendAudit(actorID string, action string, target string, detail string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return err
	}
	return appendAuditInState(state, actorID, action, target, detail, s.saveStateLocked)
}

func (s *PlatformStore) UpsertStudent(req CreateStudentRequest, actorID string) (Student, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Student{}, err
	}
	return upsertStudentInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertCourse(req CreateCourseRequest, actorID string) (Course, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Course{}, err
	}
	return upsertCourseInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertLesson(req CreateLessonRequest, analysis KnowledgeAnalysis, fileName string, actorID string) (Lesson, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Lesson{}, err
	}
	return upsertLessonInState(state, req, analysis, fileName, actorID, s.saveStateLocked)
}

func (s *PlatformStore) UpsertHomework(req CreateHomeworkRequest, actorID string) (HomeworkTask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return HomeworkTask{}, err
	}
	return upsertHomeworkInState(state, req, actorID, s.saveStateLocked)
}

func (s *PlatformStore) AddHomeworkAttempt(attempt HomeworkAttempt) (HomeworkAttempt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return HomeworkAttempt{}, err
	}
	return addHomeworkAttemptInState(state, attempt, s.saveStateLocked)
}

func (s *PlatformStore) ResetHomeworkAttempts(homeworkID string, studentID string, actorID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return 0, err
	}
	return resetHomeworkAttemptsInState(state, homeworkID, studentID, actorID, s.saveStateLocked)
}

func (s *PlatformStore) AddSession(session LearningSession) (LearningSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return LearningSession{}, err
	}
	return addSessionInState(state, session, s.saveStateLocked)
}

func (s *PlatformStore) ListConversations(ownerID string) ([]Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return nil, err
	}
	return listConversationsForOwner(state, ownerID), nil
}

func (s *PlatformStore) ConversationByID(id string, ownerID string) (Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Conversation{}, err
	}
	return conversationForOwner(state, id, ownerID)
}

func (s *PlatformStore) UpsertConversation(req SaveConversationRequest, ownerID string) (Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return Conversation{}, err
	}
	return upsertConversationInState(state, req, ownerID, s.saveStateLocked)
}

func (s *PlatformStore) DeleteConversation(id string, ownerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return err
	}
	return deleteConversationInState(state, id, ownerID, s.saveStateLocked)
}

func (s *PlatformStore) SearchLessons(query string, courseID string, limit int) ([]RetrievalHit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return nil, err
	}
	return searchLessonsInState(state, query, courseID, limit), nil
}

func (s *PlatformStore) RetrievalStats() (RetrievalIndexStats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadLocked()
	if err != nil {
		return RetrievalIndexStats{}, err
	}
	count := 0
	for _, lesson := range state.Lessons {
		if !lesson.Archived {
			count++
		}
	}
	return RetrievalIndexStats{Status: "json-index", IndexedCount: count}, nil
}

func (s *PlatformStore) loadLocked() (PlatformState, error) {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return seedState(), nil
	}
	if err != nil {
		return PlatformState{}, err
	}
	var state PlatformState
	if err := json.Unmarshal(data, &state); err != nil {
		return PlatformState{}, err
	}
	state = ensureStateDefaults(state)
	return state, nil
}

func (s *PlatformStore) saveStateLocked(state PlatformState) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0644)
}

func (s *PlatformStore) saveLocked(state PlatformState) error {
	return s.saveStateLocked(state)
}

// defaultSchoolIDValue 演示/迁移共用的默认学校 ID，保证新旧数据落到同一所学校。
const defaultSchoolIDValue = "school_demo"

func defaultDemoSchool(ts string) School {
	return School{ID: defaultSchoolIDValue, Name: "云元示范大学", Code: "YUNYUAN-DEMO", CreatedAt: ts, UpdatedAt: ts}
}

// defaultSchoolID 取状态内首个未归档学校作为“默认学校”（新建班级/用户未指定 school_id 时落入）。
func defaultSchoolID(state PlatformState) string {
	for _, school := range state.Schools {
		if !school.Archived {
			return school.ID
		}
	}
	if len(state.Schools) > 0 {
		return state.Schools[0].ID
	}
	return ""
}

func seedState() PlatformState {
	ts := nowString()
	state := PlatformState{
		Schools:  []School{defaultDemoSchool(ts)},
		Classes:  []Class{{ID: "class_cs_2026", Name: "计算机科学 2026 级 1 班", Grade: "大学本科", TeacherID: "teacher_001", SchoolID: defaultSchoolIDValue, CreatedAt: ts, UpdatedAt: ts}},
		Students: []Student{{ID: "student_001", Name: "学生A", ClassID: "class_cs_2026", UserID: "student_user_001", CreatedAt: ts, UpdatedAt: ts}, {ID: "student_002", Name: "学生B", ClassID: "class_cs_2026", CreatedAt: ts, UpdatedAt: ts}},
		Courses:  []Course{{ID: "course_db", Name: "数据库原理", ClassID: "class_cs_2026", CreatedAt: ts, UpdatedAt: ts}},
		Lessons: []Lesson{{
			ID:           "lesson_001",
			CourseID:     "course_db",
			Title:        "关系模型与 SQL 查询基础",
			Content:      "数据库原理：数据模型、关系模型、主键与外键、关系代数、SQL 查询、规范化与事务 ACID。",
			Analysis:     fallbackKnowledge("数据库原理：数据模型、关系模型、主键与外键、关系代数、SQL 查询、规范化与事务 ACID。"),
			AnalysisDone: true,
			CreatedAt:    ts,
			UpdatedAt:    ts,
		}},
		Homeworks: []HomeworkTask{{
			ID:       "homework_db_001",
			CourseID: "course_db",
			ClassID:  "class_cs_2026",
			LessonID: "lesson_001",
			Title:    "关系模型与外键约束分步作业",
			Prompt:   "解释关系模型中主键、外键与引用完整性的关系。不要直接背定义，要用自己的话说明，并给出一个学生选课场景的例子。",
			Steps: normalizeHomeworkSteps([]HomeworkStep{
				{Index: 0, Title: "先解释", Instruction: "用自己的话解释关系模型、主键、外键分别解决什么问题。", Expected: "能区分表结构、唯一标识和表间引用。"},
				{Index: 1, Title: "再举例", Instruction: "用学生表、课程表、选课表举一个外键约束的例子。", Expected: "能指出外键字段引用哪张表的主键。"},
				{Index: 2, Title: "最后反思", Instruction: "反思如果没有外键约束，数据库可能出现什么异常。", Expected: "能说明引用不存在记录、删除/更新异常等问题。"},
			}, ""),
			Published:   true,
			CreatedBy:   "teacher_001",
			CreatedAt:   ts,
			UpdatedAt:   ts,
			PublishedAt: ts,
		}},
		Audit: []AuditLog{{ID: ensureID("", "audit"), ActorID: "system", Action: "system.seed", Target: "platform", Detail: "初始化演示业务数据", CreatedAt: ts}},
		LLMConfig: LLMConfig{
			BaseURL:   "http://127.0.0.1:8080",
			Model:     "deepseek-v4-flash",
			Enabled:   true,
			UpdatedAt: ts,
		},
	}
	return ensureStateDefaults(state)
}

func ensureStateDefaults(state PlatformState) PlatformState {
	if len(state.Users) == 0 {
		ts := nowString()
		state.Users = []User{
			{ID: "admin_001", Username: "admin", Name: "系统管理员", Role: "admin", SchoolID: defaultSchoolIDValue, Active: true, PasswordHash: hashPassword("admin123456"), CreatedAt: ts, UpdatedAt: ts},
			{ID: "teacher_001", Username: "teacher", Name: "数据库原理教师", Role: "teacher", ClassIDs: []string{"class_cs_2026"}, SchoolID: defaultSchoolIDValue, Active: true, PasswordHash: hashPassword("teacher123456"), CreatedAt: ts, UpdatedAt: ts},
			{ID: "student_user_001", Username: "student001", Name: "学生A", Role: "student", ClassIDs: []string{"class_cs_2026"}, StudentID: "student_001", SchoolID: defaultSchoolIDValue, Active: true, PasswordHash: hashPassword("student123456"), CreatedAt: ts, UpdatedAt: ts},
		}
	}
	// 学校层级迁移：旧数据没有 schools 但已有班级/用户时，补建默认学校，
	// 并把缺 school_id 的班级/用户统一回填到默认学校（加载即自动生效）。
	if len(state.Schools) == 0 && (len(state.Classes) > 0 || len(state.Users) > 0) {
		state.Schools = []School{defaultDemoSchool(nowString())}
	}
	if schoolID := defaultSchoolID(state); schoolID != "" {
		for index, class := range state.Classes {
			if class.SchoolID == "" {
				state.Classes[index].SchoolID = schoolID
			}
		}
		for index, user := range state.Users {
			if user.SchoolID == "" {
				state.Users[index].SchoolID = schoolID
			}
		}
	}
	for index, user := range state.Users {
		if user.Username == "student001" && user.StudentID == "" {
			state.Users[index].StudentID = "student_001"
		}
		if user.Username == "teacher" && len(user.ClassIDs) == 0 {
			state.Users[index].ClassIDs = []string{"class_cs_2026"}
		}
		if user.Username == "admin" && user.PasswordHash == "" {
			state.Users[index].PasswordHash = hashPassword("admin123456")
		}
		if user.Username == "teacher" && user.PasswordHash == "" {
			state.Users[index].PasswordHash = hashPassword("teacher123456")
		}
		if user.Username == "student001" && user.PasswordHash == "" {
			state.Users[index].PasswordHash = hashPassword("student123456")
		}
	}
	for index, class := range state.Classes {
		if class.UpdatedAt == "" {
			state.Classes[index].UpdatedAt = class.CreatedAt
		}
	}
	for index, student := range state.Students {
		if student.UpdatedAt == "" {
			state.Students[index].UpdatedAt = student.CreatedAt
		}
		if student.ID == "student_001" && student.UserID == "" {
			state.Students[index].UserID = "student_user_001"
		}
	}
	for index, course := range state.Courses {
		if course.UpdatedAt == "" {
			state.Courses[index].UpdatedAt = course.CreatedAt
		}
	}
	for index, lesson := range state.Lessons {
		if lesson.UpdatedAt == "" {
			state.Lessons[index].UpdatedAt = lesson.CreatedAt
		}
	}
	if state.AuthSessions == nil {
		state.AuthSessions = []AuthSession{}
	}
	if state.Schools == nil {
		state.Schools = []School{}
	}
	if state.Sessions == nil {
		state.Sessions = []LearningSession{}
	}
	if state.Conversations == nil {
		state.Conversations = []Conversation{}
	}
	if state.Homeworks == nil {
		state.Homeworks = []HomeworkTask{}
	}
	if len(state.Homeworks) == 0 {
		ts := nowString()
		state.Homeworks = []HomeworkTask{{
			ID:       "homework_db_001",
			CourseID: "course_db",
			ClassID:  "class_cs_2026",
			LessonID: "lesson_001",
			Title:    "关系模型与外键约束分步作业",
			Prompt:   "解释关系模型中主键、外键与引用完整性的关系。不要直接背定义，要用自己的话说明，并给出一个学生选课场景的例子。",
			Steps: normalizeHomeworkSteps([]HomeworkStep{
				{Index: 0, Title: "先解释", Instruction: "用自己的话解释关系模型、主键、外键分别解决什么问题。", Expected: "能区分表结构、唯一标识和表间引用。"},
				{Index: 1, Title: "再举例", Instruction: "用学生表、课程表、选课表举一个外键约束的例子。", Expected: "能指出外键字段引用哪张表的主键。"},
				{Index: 2, Title: "最后反思", Instruction: "反思如果没有外键约束，数据库可能出现什么异常。", Expected: "能说明引用不存在记录、删除/更新异常等问题。"},
			}, ""),
			Published:   true,
			CreatedBy:   "teacher_001",
			CreatedAt:   ts,
			UpdatedAt:   ts,
			PublishedAt: ts,
		}}
	}
	if state.Attempts == nil {
		state.Attempts = []HomeworkAttempt{}
	}
	if state.LLMConfig.BaseURL == "" {
		state.LLMConfig = LLMConfig{BaseURL: "http://127.0.0.1:8080", Model: "deepseek-v4-flash", Enabled: true, UpdatedAt: nowString()}
	}
	if state.LLMConfig.Model == "" {
		state.LLMConfig.Model = "deepseek-v4-flash"
	}
	return state
}

func normalizeHomeworkSteps(steps []HomeworkStep, prompt string) []HomeworkStep {
	if len(steps) == 0 {
		steps = []HomeworkStep{
			{Title: "解释", Instruction: "请先用自己的话解释题目中的核心概念。", Expected: "说明概念含义与相互关系。"},
			{Title: "举例", Instruction: "请结合一个具体场景举例，不要直接要答案。", Expected: "例子能对应题目概念。"},
			{Title: "反思", Instruction: "请反思自己哪里还不确定，以及如何验证。", Expected: "能说出不确定点和下一步学习策略。"},
		}
	}
	for index := range steps {
		if steps[index].Index < 0 {
			steps[index].Index = index
		}
		if steps[index].Index == 0 && index > 0 {
			steps[index].Index = index
		}
		steps[index].Title = strings.TrimSpace(steps[index].Title)
		steps[index].Instruction = strings.TrimSpace(steps[index].Instruction)
		steps[index].Expected = strings.TrimSpace(steps[index].Expected)
		if steps[index].Title == "" {
			steps[index].Title = fmt.Sprintf("第 %d 步", index+1)
		}
		if steps[index].Instruction == "" {
			steps[index].Instruction = "请完成本步骤，并解释你的思考过程。"
		}
	}
	return steps
}

func appendAudit(logs []AuditLog, actorID, action, target, detail string) []AuditLog {
	logs = append([]AuditLog{{
		ID:        ensureID("", "audit"),
		ActorID:   actorID,
		Action:    action,
		Target:    target,
		Detail:    detail,
		CreatedAt: nowString(),
	}}, logs...)
	if len(logs) > 300 {
		return logs[:300]
	}
	return logs
}

func ensureID(id string, prefix string) string {
	id = strings.TrimSpace(id)
	if id != "" {
		return strings.NewReplacer("/", "_", "\\", "_", ":", "_", "..", "_").Replace(id)
	}
	return prefix + "_" + strings.ReplaceAll(time.Now().Format("20060102150405.000000000"), ".", "")
}

func upsertByID[T any](items []T, id string, value T, getID func(T) string) []T {
	for index, item := range items {
		if getID(item) == id {
			items[index] = value
			return items
		}
	}
	return append(items, value)
}

func hashPassword(password string) string {
	sum := sha256.Sum256([]byte("study-edu-system:" + password))
	return hex.EncodeToString(sum[:])
}

func randomToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return ensureID("", "token")
	}
	return hex.EncodeToString(buf)
}
