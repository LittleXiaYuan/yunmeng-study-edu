package edu_service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type requestUserKey struct{}

type MemoryStore interface {
	Load(studentID string) (StudentMemory, error)
	Save(studentID string, memory StudentMemory) error
	List() ([]StudentMemory, error)
}

type PlatformDataStore interface {
	State() (PlatformState, error)
	Login(username string, password string) (LoginResponse, error)
	UserByToken(token string) (User, bool)
	ListUsers() ([]User, error)
	LLMConfig() (LLMConfig, error)
	UpdateLLMConfig(config LLMConfig, actorID string) (LLMConfig, error)
	UpsertUser(req CreateUserRequest, actorID string) (User, error)
	UpdateUser(req UpdateUserRequest, actorID string) (User, error)
	UpdateUserImage(userID string, kind string, url string, actorID string) (User, error)
	UpsertClass(req CreateClassRequest, actorID string) (Class, error)
	UpsertSchool(req CreateSchoolRequest, actorID string) (School, error)
	AppendAudit(actorID string, action string, target string, detail string) error
	UpsertStudent(req CreateStudentRequest, actorID string) (Student, error)
	UpsertCourse(req CreateCourseRequest, actorID string) (Course, error)
	UpsertLesson(req CreateLessonRequest, analysis KnowledgeAnalysis, fileName string, actorID string) (Lesson, error)
	UpsertHomework(req CreateHomeworkRequest, actorID string) (HomeworkTask, error)
	AddHomeworkAttempt(attempt HomeworkAttempt) (HomeworkAttempt, error)
	ResetHomeworkAttempts(homeworkID string, studentID string, actorID string) (int, error)
	AddSession(session LearningSession) (LearningSession, error)
	ListConversations(ownerID string) ([]Conversation, error)
	ConversationByID(id string, ownerID string) (Conversation, error)
	UpsertConversation(req SaveConversationRequest, ownerID string) (Conversation, error)
	DeleteConversation(id string, ownerID string) error
	SearchLessons(query string, courseID string, limit int) ([]RetrievalHit, error)
	RetrievalStats() (RetrievalIndexStats, error)
}

type Service struct {
	store    MemoryStore
	platform PlatformDataStore
	agent    AgentClient
	dataDir  string
}

func NewService(store MemoryStore, platform PlatformDataStore, agent AgentClient, dataDir string) *Service {
	return &Service{store: store, platform: platform, agent: agent, dataDir: dataDir}
}

func (s *Service) Analyze(ctx context.Context, req AnalyzeRequest) KnowledgeAnalysis {
	return s.teacherAgent(ctx, req)
}

func (s *Service) Login(req LoginRequest) (LoginResponse, error) {
	resp, err := s.platform.Login(req.Username, req.Password)
	if err != nil {
		return LoginResponse{}, err
	}
	resp.User = sanitizeUser(resp.User)
	return resp, nil
}

func (s *Service) UserByToken(token string) (User, bool) {
	user, ok := s.platform.UserByToken(token)
	return sanitizeUser(user), ok
}

func (s *Service) ListUsers() ([]User, error) {
	users, err := s.platform.ListUsers()
	if err != nil {
		return nil, err
	}
	return sanitizeUsers(users), nil
}

func (s *Service) LLMConfig(ctx context.Context) (LLMConfig, error) {
	if _, err := RequireRole(ctx, "admin", "teacher"); err != nil {
		return LLMConfig{}, err
	}
	config, err := s.platform.LLMConfig()
	return sanitizeLLMConfig(config), err
}

func (s *Service) UpdateLLMConfig(ctx context.Context, config LLMConfig) (LLMConfig, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return LLMConfig{}, err
	}
	saved, err := s.platform.UpdateLLMConfig(config, actor.ID)
	if err != nil {
		return LLMConfig{}, err
	}
	if configurable, ok := s.agent.(ConfigurableAgentClient); ok {
		runtimeConfig, runtimeErr := s.platform.LLMConfig()
		if runtimeErr != nil {
			runtimeConfig = config
		}
		configurable.Configure(LLMConfig{BaseURL: runtimeConfig.BaseURL, APIKey: runtimeConfig.APIKey, Model: runtimeConfig.Model, Enabled: runtimeConfig.Enabled})
	}
	return saved, nil
}

func (s *Service) ListClasses(ctx context.Context) ([]Class, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Classes, nil
}

func (s *Service) ListCourses(ctx context.Context) ([]Course, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Courses, nil
}

func (s *Service) ListStudents(ctx context.Context) ([]Student, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Students, nil
}

func (s *Service) ListLessons(ctx context.Context) ([]Lesson, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Lessons, nil
}

func (s *Service) ListHomeworks(ctx context.Context) ([]HomeworkTask, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Homeworks, nil
}

func (s *Service) ListSessions(ctx context.Context) ([]LearningSession, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.Sessions, nil
}

// —— 对话历史（按登录用户归属隔离；ownerID 恒取自 ctx，不信任请求体）——

func (s *Service) ListConversations(ctx context.Context) ([]Conversation, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return nil, err
	}
	return s.platform.ListConversations(actor.ID)
}

func (s *Service) ConversationDetail(ctx context.Context, id string) (Conversation, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Conversation{}, err
	}
	return s.platform.ConversationByID(id, actor.ID)
}

func (s *Service) SaveConversation(ctx context.Context, req SaveConversationRequest) (Conversation, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Conversation{}, err
	}
	return s.platform.UpsertConversation(req, actor.ID)
}

func (s *Service) RemoveConversation(ctx context.Context, id string) error {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return err
	}
	return s.platform.DeleteConversation(id, actor.ID)
}

func (s *Service) ListAuditLogs(ctx context.Context) ([]AuditLog, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	return dashboard.AuditLogs, nil
}

func (s *Service) CreateUser(ctx context.Context, req CreateUserRequest) (User, error) {
	actor, err := RequireRole(ctx, "admin")
	if err != nil {
		return User{}, err
	}
	if req.Role == "" {
		req.Role = "teacher"
	}
	if req.Role == "student" && req.StudentID == "" {
		req.StudentID = ensureID("", "student")
	}
	if (req.Role == "student" || req.Role == "teacher") && len(req.ClassIDs) == 0 {
		req.ClassIDs = []string{"class_cs_2026"}
	}
	// school_id 可选：空则落到默认学校（更新场景下 upsertUserInState 会保留原值）。
	if strings.TrimSpace(req.SchoolID) == "" && strings.TrimSpace(req.ID) == "" {
		if state, err := s.platform.State(); err == nil {
			req.SchoolID = defaultSchoolID(state)
		}
	}
	user, err := s.platform.UpsertUser(req, actor.ID)
	return sanitizeUser(user), err
}

func (s *Service) UpdateUser(ctx context.Context, req UpdateUserRequest) (User, error) {
	actor, err := RequireRole(ctx, "admin")
	if err != nil {
		return User{}, err
	}
	user, err := s.platform.UpdateUser(req, actor.ID)
	return sanitizeUser(user), err
}

func (s *Service) UploadUserImage(ctx context.Context, targetUserID string, kind string, data []byte) (User, error) {
	actor, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return User{}, err
	}
	targetUserID = strings.TrimSpace(targetUserID)
	if actor.Role != "admin" && targetUserID != actor.ID {
		return User{}, errors.New("permission denied: cannot modify another user's image")
	}
	if kind != "avatar" && kind != "background" {
		return User{}, errors.New("invalid image kind")
	}
	users, err := s.platform.ListUsers()
	if err != nil {
		return User{}, err
	}
	found := false
	for _, u := range users {
		if u.ID == targetUserID {
			found = true
			break
		}
	}
	if !found {
		return User{}, errors.New("user not found")
	}
	url, err := SaveUserImage(s.dataDir, targetUserID, kind, data)
	if err != nil {
		return User{}, err
	}
	user, err := s.platform.UpdateUserImage(targetUserID, kind, url, actor.ID)
	if err != nil {
		return User{}, err
	}
	return sanitizeUser(user), nil
}

func (s *Service) AuthMiddleware(next http.Handler) http.Handler {
	public := map[string]bool{
		"/healthz":     true,
		"/auth/login":  true,
		"/auth/status": true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions || public[r.URL.Path] || strings.HasPrefix(r.URL.Path, "/uploads/") {
			next.ServeHTTP(w, r)
			return
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing bearer token"})
			return
		}
		user, ok := s.UserByToken(token)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestUserKey{}, user)))
	})
}

func CurrentUser(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(requestUserKey{}).(User)
	return user, ok
}

func RequireRole(ctx context.Context, roles ...string) (User, error) {
	user, ok := CurrentUser(ctx)
	if !ok {
		return User{}, errors.New("missing authenticated user")
	}
	for _, role := range roles {
		if user.Role == role {
			return user, nil
		}
	}
	return User{}, errors.New("permission denied")
}

// rejectMojibake 拦截含 U+FFFD 替换符的字段：几乎都是客户端（Windows 终端 curl /
// 旧 PowerShell）用 GBK 等本地编码提交中文导致，入库后原文不可恢复，宁可创建时报错。
func rejectMojibake(fields map[string]string) error {
	for label, value := range fields {
		if strings.ContainsRune(value, '�') {
			return fmt.Errorf("%s包含乱码字符（疑似客户端未按 UTF-8 提交中文），请修正编码后重试", label)
		}
	}
	return nil
}

func (s *Service) CreateClass(ctx context.Context, req CreateClassRequest) (Class, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Class{}, err
	}
	if err := rejectMojibake(map[string]string{"班级名称": req.Name, "年级": req.Grade}); err != nil {
		return Class{}, err
	}
	// school_id 可选：空则落到默认学校；非空则校验学校存在。
	state, err := s.platform.State()
	if err != nil {
		return Class{}, err
	}
	req.SchoolID = strings.TrimSpace(req.SchoolID)
	if req.SchoolID == "" {
		req.SchoolID = defaultSchoolID(state)
	} else {
		found := false
		for _, school := range state.Schools {
			if school.ID == req.SchoolID {
				found = true
				break
			}
		}
		if !found {
			return Class{}, errors.New("school not found")
		}
	}
	return s.platform.UpsertClass(req, actor.ID)
}

// CreateSchool 学校 upsert（仅 admin）。归档仍有未归档班级的学校时：
// 仅标记归档、不级联处理班级，并通过响应 message 给出提示。
func (s *Service) CreateSchool(ctx context.Context, req CreateSchoolRequest) (SchoolResponse, error) {
	actor, err := s.requireSchoolAccess(ctx)
	if err != nil {
		return SchoolResponse{}, err
	}
	if err := rejectMojibake(map[string]string{"学校名称": req.Name, "学校代码": req.Code}); err != nil {
		return SchoolResponse{}, err
	}
	message := ""
	if req.Archived != nil && *req.Archived && strings.TrimSpace(req.ID) != "" {
		state, stateErr := s.platform.State()
		if stateErr != nil {
			return SchoolResponse{}, stateErr
		}
		active := 0
		for _, class := range state.Classes {
			if class.SchoolID == strings.TrimSpace(req.ID) && !class.Archived {
				active++
			}
		}
		if active > 0 {
			message = fmt.Sprintf("学校已标记归档；仍有 %d 个未归档班级挂在该校，请另行处理（未级联归档）", active)
		}
	}
	school, err := s.platform.UpsertSchool(req, actor.ID)
	if err != nil {
		return SchoolResponse{}, err
	}
	return SchoolResponse{School: school, Message: message}, nil
}

// ImportStudents 批量导入学生：teacher 限本班（requireClassAccess），admin 任意班。
// 逐行复用 CreateStudent，单行失败（姓名空/用户名重复）计入 failed 不中断整批。
func (s *Service) ImportStudents(ctx context.Context, req ImportStudentsRequest) (ImportStudentsResponse, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return ImportStudentsResponse{}, err
	}
	classID := strings.TrimSpace(req.ClassID)
	if classID == "" {
		return ImportStudentsResponse{}, errors.New("class_id is required")
	}
	class, err := s.requireClassAccess(ctx, classID)
	if err != nil {
		return ImportStudentsResponse{}, err
	}
	if len(req.Rows) == 0 {
		return ImportStudentsResponse{}, errors.New("rows is required")
	}
	// 预取已有用户名，create_user 时提前拦截重复，避免“建了学生档案但账号创建失败”的半成品。
	taken := map[string]bool{}
	if req.CreateUser {
		users, err := s.platform.ListUsers()
		if err != nil {
			return ImportStudentsResponse{}, err
		}
		for _, user := range users {
			taken[user.Username] = true
		}
	}
	resp := ImportStudentsResponse{Errors: []string{}, Items: []Student{}}
	for index, row := range req.Rows {
		name := strings.TrimSpace(row.Name)
		username := strings.TrimSpace(row.Username)
		if name == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, fmt.Sprintf("第 %d 行：姓名不能为空", index+1))
			continue
		}
		if req.CreateUser && username != "" && taken[username] {
			resp.Failed++
			resp.Errors = append(resp.Errors, fmt.Sprintf("第 %d 行（%s）：用户名已存在", index+1, username))
			continue
		}
		student, err := s.CreateStudent(ctx, CreateStudentRequest{
			Name:       name,
			ClassID:    class.ID,
			CreateUser: req.CreateUser,
			Username:   username,
			Password:   row.Password,
		})
		if err != nil {
			resp.Failed++
			label := username
			if label == "" {
				label = name
			}
			resp.Errors = append(resp.Errors, fmt.Sprintf("第 %d 行（%s）：%v", index+1, label, err))
			continue
		}
		if username != "" {
			taken[username] = true
		}
		resp.Created++
		resp.Items = append(resp.Items, student)
	}
	_ = s.platform.AppendAudit(actor.ID, "student_import", class.ID, fmt.Sprintf("created=%d failed=%d", resp.Created, resp.Failed))
	return resp, nil
}

func (s *Service) CreateStudent(ctx context.Context, req CreateStudentRequest) (Student, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Student{}, err
	}
	if err := rejectMojibake(map[string]string{"学生姓名": req.Name, "用户名": req.Username}); err != nil {
		return Student{}, err
	}
	if strings.TrimSpace(req.ClassID) == "" {
		class, err := s.defaultClassForUser(ctx)
		if err != nil {
			return Student{}, err
		}
		req.ClassID = class.ID
	}
	if _, err := s.requireClassAccess(ctx, req.ClassID); err != nil {
		return Student{}, err
	}
	student, err := s.platform.UpsertStudent(req, actor.ID)
	if err != nil {
		return Student{}, err
	}
	if !req.CreateUser {
		return student, nil
	}
	username := strings.TrimSpace(req.Username)
	if username == "" {
		username = student.ID
	}
	password := req.Password
	if password == "" {
		password = "student123456"
	}
	active := true
	user, err := s.platform.UpsertUser(CreateUserRequest{
		Username:  username,
		Password:  password,
		Name:      student.Name,
		Role:      "student",
		ClassIDs:  []string{student.ClassID},
		StudentID: student.ID,
		Active:    &active,
	}, actor.ID)
	if err != nil {
		return Student{}, err
	}
	student.UserID = user.ID
	return s.platform.UpsertStudent(CreateStudentRequest{
		ID:      student.ID,
		Name:    student.Name,
		ClassID: student.ClassID,
		UserID:  user.ID,
	}, actor.ID)
}

func (s *Service) CreateCourse(ctx context.Context, req CreateCourseRequest) (Course, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Course{}, err
	}
	if err := rejectMojibake(map[string]string{"课程名称": req.Name}); err != nil {
		return Course{}, err
	}
	if strings.TrimSpace(req.ClassID) == "" {
		class, err := s.defaultClassForUser(ctx)
		if err != nil {
			return Course{}, err
		}
		req.ClassID = class.ID
	}
	if _, err := s.requireClassAccess(ctx, req.ClassID); err != nil {
		return Course{}, err
	}
	return s.platform.UpsertCourse(req, actor.ID)
}

func (s *Service) CreateLesson(ctx context.Context, req CreateLessonRequest, fileName string) (Lesson, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return Lesson{}, err
	}
	if err := rejectMojibake(map[string]string{"教案标题": req.Title}); err != nil {
		return Lesson{}, err
	}
	if strings.TrimSpace(req.CourseID) == "" && strings.TrimSpace(req.ID) != "" {
		lesson, err := s.requireLessonAccess(ctx, req.ID)
		if err != nil {
			return Lesson{}, err
		}
		req.CourseID = lesson.CourseID
	}
	course, err := s.requireCourseAccess(ctx, req.CourseID)
	if err != nil {
		return Lesson{}, err
	}
	req.CourseID = course.ID
	analysis := KnowledgeAnalysis{}
	if strings.TrimSpace(req.Content) != "" {
		analysis = s.Analyze(ctx, AnalyzeRequest{CourseID: req.CourseID, LessonID: req.ID, Content: req.Content})
	}
	return s.platform.UpsertLesson(req, analysis, fileName, actor.ID)
}

func (s *Service) CreateHomework(ctx context.Context, req CreateHomeworkRequest) (HomeworkTask, error) {
	actor, err := RequireRole(ctx, "admin", "teacher")
	if err != nil {
		return HomeworkTask{}, err
	}
	if err := rejectMojibake(map[string]string{"任务标题": req.Title}); err != nil {
		return HomeworkTask{}, err
	}
	course, err := s.requireCourseAccess(ctx, req.CourseID)
	if err != nil {
		return HomeworkTask{}, err
	}
	req.CourseID = course.ID
	if strings.TrimSpace(req.ClassID) == "" {
		req.ClassID = course.ClassID
	}
	if req.ClassID != course.ClassID {
		return HomeworkTask{}, errors.New("class_id does not match course")
	}
	if _, err := s.requireClassAccess(ctx, req.ClassID); err != nil {
		return HomeworkTask{}, err
	}
	if strings.TrimSpace(req.LessonID) != "" {
		lesson, err := s.requireLessonAccess(ctx, req.LessonID)
		if err != nil {
			return HomeworkTask{}, err
		}
		if lesson.CourseID != req.CourseID {
			return HomeworkTask{}, errors.New("lesson does not belong to course")
		}
	}
	return s.platform.UpsertHomework(req, actor.ID)
}

func (s *Service) AutoCreateHomework(ctx context.Context, req AutoHomeworkRequest) (AutoHomeworkResponse, error) {
	if _, err := RequireRole(ctx, "admin", "teacher"); err != nil {
		return AutoHomeworkResponse{}, err
	}
	courseID := strings.TrimSpace(req.CourseID)
	course, err := s.requireCourseAccess(ctx, courseID)
	if err != nil {
		return AutoHomeworkResponse{}, err
	}
	courseID = course.ID
	classID := strings.TrimSpace(req.ClassID)
	if classID == "" {
		classID = course.ClassID
	}
	if classID != course.ClassID {
		return AutoHomeworkResponse{}, errors.New("class_id does not match course")
	}
	if _, err := s.requireClassAccess(ctx, classID); err != nil {
		return AutoHomeworkResponse{}, err
	}
	content := strings.TrimSpace(req.LessonContent)
	goal := strings.TrimSpace(req.TeacherGoal)
	if content == "" && goal == "" {
		return AutoHomeworkResponse{}, errors.New("请先输入课程资料或练习要求")
	}
	if content == "" {
		content = goal
	}
	analysis := s.Analyze(ctx, AnalyzeRequest{CourseID: courseID, LessonID: req.LessonID, Content: content + "\n" + goal})
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = inferTitle(goal+" "+content, "自动生成练习")
	}
	lessonTitle := title
	if !strings.Contains(lessonTitle, "资料") {
		lessonTitle += " 资料"
	}
	lesson, err := s.CreateLesson(ctx, CreateLessonRequest{ID: req.LessonID, CourseID: courseID, Title: lessonTitle, Content: content}, "")
	if err != nil {
		return AutoHomeworkResponse{}, err
	}
	publish := true
	if req.Publish != nil {
		publish = *req.Publish
	}
	steps := buildHomeworkStepsFromAnalysis(analysis, goal)
	prompt := goal
	if prompt == "" {
		prompt = "请围绕「" + strings.Join(limitStrings(analysis.Concepts, 3), "、") + "」完成说明、举例和反思。"
	}
	homework, err := s.CreateHomework(ctx, CreateHomeworkRequest{
		CourseID:  courseID,
		ClassID:   classID,
		LessonID:  lesson.ID,
		Title:     title,
		Prompt:    prompt,
		Steps:     steps,
		Published: &publish,
	})
	if err != nil {
		return AutoHomeworkResponse{}, err
	}
	return AutoHomeworkResponse{Lesson: lesson, Homework: homework, Analysis: analysis, Message: "已根据课程资料自动生成并发布练习任务"}, nil
}
func (s *Service) HomeworkAttempts(ctx context.Context, homeworkID string) ([]HomeworkAttempt, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return nil, err
	}
	if _, err := s.requireHomeworkAccess(ctx, homeworkID); err != nil {
		return nil, err
	}
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return nil, err
	}
	out := []HomeworkAttempt{}
	for _, attempt := range dashboard.HomeworkAttempts {
		if attempt.HomeworkID != homeworkID {
			continue
		}
		if user.Role == "student" && attempt.StudentID != user.StudentID {
			continue
		}
		out = append(out, attempt)
	}
	return out, nil
}

func (s *Service) ResetHomeworkAttempts(ctx context.Context, homeworkID string, req ResetHomeworkAttemptsRequest) (ResetHomeworkAttemptsResponse, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return ResetHomeworkAttemptsResponse{}, err
	}
	homework, err := s.requireHomeworkAccess(ctx, homeworkID)
	if err != nil {
		return ResetHomeworkAttemptsResponse{}, err
	}
	studentID := strings.TrimSpace(req.StudentID)
	if user.Role == "student" {
		studentID = user.StudentID
	}
	if studentID != "" {
		student, err := s.requireStudentAccess(ctx, studentID)
		if err != nil {
			return ResetHomeworkAttemptsResponse{}, err
		}
		if student.ClassID != homework.ClassID {
			return ResetHomeworkAttemptsResponse{}, errors.New("student is not assigned to homework class")
		}
		studentID = student.ID
	}
	deleted, err := s.platform.ResetHomeworkAttempts(homework.ID, studentID, user.ID)
	if err != nil {
		return ResetHomeworkAttemptsResponse{}, err
	}
	return ResetHomeworkAttemptsResponse{HomeworkID: homework.ID, StudentID: studentID, Deleted: deleted}, nil
}

func (s *Service) SubmitHomework(ctx context.Context, req SubmitHomeworkRequest) (GuidedHomeworkResponse, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return GuidedHomeworkResponse{}, err
	}
	if user.Role == "student" {
		req.StudentID = user.StudentID
	}
	if req.StudentID == "" {
		student, err := s.defaultStudentForUser(ctx)
		if err != nil {
			return GuidedHomeworkResponse{}, err
		}
		req.StudentID = student.ID
	}
	student, err := s.requireStudentAccess(ctx, req.StudentID)
	if err != nil {
		return GuidedHomeworkResponse{}, err
	}
	req.StudentID = student.ID
	homework, err := s.requireHomeworkAccess(ctx, req.HomeworkID)
	if err != nil {
		return GuidedHomeworkResponse{}, err
	}
	if homework.ClassID != student.ClassID {
		return GuidedHomeworkResponse{}, errors.New("homework is not assigned to student class")
	}
	if len(homework.Steps) == 0 {
		homework.Steps = normalizeHomeworkSteps(nil, homework.Prompt)
	}
	if req.StepIndex < 0 || req.StepIndex >= len(homework.Steps) {
		req.StepIndex = 0
	}
	answer := strings.TrimSpace(req.Answer)
	if answer == "" {
		return GuidedHomeworkResponse{}, errors.New("answer is required")
	}
	step := homework.Steps[req.StepIndex]
	evaluation := s.homeworkStepEvaluatorAgent(ctx, homework, step, answer)
	memory, err := s.store.Load(req.StudentID)
	if err != nil {
		return GuidedHomeworkResponse{}, err
	}
	memory.UnderstandingScore = evaluation.UnderstandingScore
	memory.ReflectionLevel = evaluation.ReflectionLevel
	memory.TrustScore = homeworkTrustScore(evaluation)
	memory.CommonErrors = mergeStrings(memory.CommonErrors, evaluation.ErrorTypes)
	if evaluation.UnderstandingScore < 60 {
		memory.KnowledgeWeakness = mergeStrings(memory.KnowledgeWeakness, []string{step.Title + "理解不稳"})
	}
	if evaluation.ReflectionLevel >= 70 {
		memory.ThinkingStyle = "reflective"
	} else if evaluation.ThinkingDepth >= 70 {
		memory.ThinkingStyle = "analytical"
	} else {
		memory.ThinkingStyle = "surface"
	}
	if err := s.store.Save(req.StudentID, memory); err != nil {
		return GuidedHomeworkResponse{}, err
	}
	trust := TrustPolicyFor(memory.TrustScore)
	completedStep := evaluation.ReallyUnderstood || (evaluation.UnderstandingScore >= 65 && evaluation.ExplanationQuality >= 55)
	completedHomework := completedStep && req.StepIndex >= len(homework.Steps)-1
	nextIndex := req.StepIndex
	if completedStep && !completedHomework {
		nextIndex++
	}
	var nextStep *HomeworkStep
	if !completedHomework {
		ns := homework.Steps[nextIndex]
		nextStep = &ns
	}
	guidance := s.buildGuidedHomeworkMessage(ctx, homework, step, answer, evaluation, trust, completedStep, completedHomework, nextStep, student, memory)
	attempt, err := s.platform.AddHomeworkAttempt(HomeworkAttempt{
		HomeworkID:         homework.ID,
		StudentID:          req.StudentID,
		StepIndex:          req.StepIndex,
		Answer:             answer,
		Guidance:           guidance,
		Evaluation:         evaluation,
		TrustScore:         memory.TrustScore,
		UnlockedPermission: trust.Permission,
		CompletedStep:      completedStep,
		CompletedHomework:  completedHomework,
		NextRequiredAction: nextActionLabel(completedStep, completedHomework, nextStep),
	})
	if err != nil {
		return GuidedHomeworkResponse{}, err
	}
	return GuidedHomeworkResponse{Homework: homework, Attempt: attempt, Trust: trust, NextStep: nextStep, Message: guidance, Memory: memory}, nil
}

func (s *Service) AgentWrite(ctx context.Context, req AgentWriteRequest) (AgentWriteResponse, error) {
	if _, err := RequireRole(ctx, "admin", "teacher"); err != nil {
		return AgentWriteResponse{}, err
	}
	target := strings.TrimSpace(req.Target)
	if target == "" {
		target = "lesson"
	}
	switch target {
	case "lesson":
		content := strings.TrimSpace(req.Content)
		if content == "" {
			content = strings.TrimSpace(req.Prompt)
		}
		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = inferTitle(content, "Agent 生成教案")
		}
		lesson, err := s.CreateLesson(ctx, CreateLessonRequest{CourseID: strings.TrimSpace(req.CourseID), Title: title, Content: content}, "")
		if err != nil {
			return AgentWriteResponse{}, err
		}
		return AgentWriteResponse{Target: "lesson", Lesson: &lesson, Analysis: lesson.Analysis, Message: "已写入教案库并完成 TeacherAgent 解析"}, nil
	case "course":
		name := strings.TrimSpace(req.Title)
		if name == "" {
			name = inferTitle(req.Content+req.Prompt, "数据库原理")
		}
		course, err := s.CreateCourse(ctx, CreateCourseRequest{Name: name, ClassID: strings.TrimSpace(req.ClassID)})
		if err != nil {
			return AgentWriteResponse{}, err
		}
		return AgentWriteResponse{Target: "course", Course: &course, Message: "已写入课程库"}, nil
	default:
		return AgentWriteResponse{}, errors.New("unsupported write target")
	}
}

func (s *Service) AgentChat(ctx context.Context, req AgentChatRequest) (AgentChatResponse, error) {
	if _, err := RequireRole(ctx, "admin", "teacher", "student"); err != nil {
		return AgentChatResponse{}, err
	}
	if strings.TrimSpace(req.CourseID) != "" {
		if _, err := s.requireCourseAccess(ctx, req.CourseID); err != nil {
			return AgentChatResponse{}, err
		}
	}
	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		mode = "teacher"
	}
	prompt := promptForAgentMode(mode)
	userInput := strings.TrimSpace(req.Message)
	if req.Context != "" {
		userInput = "课程上下文：" + req.Context + "\n\n用户消息：" + userInput
	}
	if userInput == "" {
		return AgentChatResponse{}, errors.New("message is required")
	}
	config, _ := s.platform.LLMConfig()
	if !config.Enabled {
		return AgentChatResponse{Mode: mode, Message: "LLM 未启用，请先在配置中启用云雀 /v1 接口。", PromptUsed: prompt, LLMStatus: "disabled"}, nil
	}
	text, err := s.agent.Call(ctx, prompt, userInput)
	if err != nil {
		return AgentChatResponse{
			Mode:       mode,
			Message:    "LLM 暂时不可用：" + err.Error(),
			PromptUsed: prompt,
			LLMStatus:  "error",
		}, nil
	}
	return AgentChatResponse{Mode: mode, Message: strings.TrimSpace(text), PromptUsed: prompt, LLMStatus: "ok"}, nil
}

func (s *Service) AgentCommand(ctx context.Context, req AgentCommandRequest) (AgentDirective, error) {
	if _, err := RequireRole(ctx, "admin", "teacher"); err != nil {
		return AgentDirective{}, err
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		return AgentDirective{}, errors.New("message is required")
	}
	config, _ := s.platform.LLMConfig()
	if !config.Enabled {
		d := heuristicDirective(req)
		d.LLMStatus = "disabled"
		return d, nil
	}
	input := fmt.Sprintf("【工作台快照 / 附件说明】\n%s\n\n【历史对话】\n%s\n\n【教师指令】\n%s",
		strings.TrimSpace(req.Context), mustJSON(req.History), message)
	text, err := s.agent.Call(ctx, AgentCommandPrompt, input)
	if err != nil {
		d := heuristicDirective(req)
		d.LLMStatus = "error"
		return d, nil
	}
	var directive AgentDirective
	if decodeJSONObject(text, &directive) != nil || (strings.TrimSpace(directive.Reply) == "" && len(directive.Cards) == 0) {
		d := heuristicDirective(req)
		d.LLMStatus = "fallback"
		return d, nil
	}
	directive.LLMStatus = "ok"
	if directive.Intent == "knowledge_analysis" {
		analysis := s.teacherAgent(ctx, AnalyzeRequest{Content: message + " " + req.Context})
		directive.Cards = append(directive.Cards, AgentCard{
			Type:  "analysis",
			Title: "知识点拆解",
			Items: append(append([]string{}, analysis.Concepts...), analysis.Difficulties...),
		})
	}
	return directive, nil
}

// chatPrepared 是 Chat / ChatStream 共用的前置结果：鉴权、RAG 检索、信任策略。
type chatPrepared struct {
	req    ChatRequest
	memory StudentMemory
	trust  TrustPolicy
	rag    RAGContext
}

func (s *Service) prepareChat(ctx context.Context, req ChatRequest) (chatPrepared, error) {
	student, err := s.requireStudentAccess(ctx, req.StudentID)
	if err != nil {
		return chatPrepared{}, err
	}
	req.StudentID = student.ID
	course, err := s.requireCourseAccess(ctx, req.CourseID)
	if err != nil {
		return chatPrepared{}, err
	}
	if course.ClassID != student.ClassID {
		return chatPrepared{}, errors.New("course is not assigned to student class")
	}
	req.CourseID = course.ID
	req.Retrieval = filterRetrievalByCourse(req.Retrieval, course.ID)
	memory, err := s.store.Load(req.StudentID)
	if err != nil {
		return chatPrepared{}, err
	}
	// 检索查询：问题 + 当前屏幕题干/阶段，让知识库更贴「正在看的页」
	ragQuery := strings.TrimSpace(req.Question)
	if req.PageContext != nil {
		ragQuery = strings.TrimSpace(strings.Join([]string{
			ragQuery,
			req.PageContext.StepTitle,
			req.PageContext.Title,
			truncateRunes(req.PageContext.Instruction, 200),
		}, " "))
	}
	rag := s.retrieveContext(ragQuery, req.CourseID, req.Retrieval)
	req.Retrieval = rag.Hits
	// 无前端课程解析时，用检索命中概念填一点 context，避免教练完全空上下文
	if len(req.Context.Concepts) == 0 && len(rag.Hits) > 0 {
		for _, h := range rag.Hits {
			req.Context.Concepts = mergeStrings(req.Context.Concepts, h.Concepts)
		}
	}
	return chatPrepared{
		req:    req,
		memory: memory,
		trust:  TrustPolicyFor(memory.TrustScore),
		rag:    rag,
	}, nil
}

func (s *Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	p, err := s.prepareChat(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	message := s.tutorAgent(ctx, p.req, p.memory)
	return ChatResponse{
		Agent:      "TutorAgent",
		Message:    message,
		Trust:      p.trust,
		Memory:     p.memory,
		PromptUsed: TutorAgentPrompt,
		RAG:        p.rag,
	}, nil
}

// ChatStream 与 Chat 等价，但通过 onDelta 增量推送教练回复（供 SSE 端点使用）。
func (s *Service) ChatStream(ctx context.Context, req ChatRequest, onDelta func(string)) (ChatResponse, error) {
	p, err := s.prepareChat(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	message := s.tutorAgentStream(ctx, p.req, p.memory, onDelta)
	return ChatResponse{
		Agent:      "TutorAgent",
		Message:    message,
		Trust:      p.trust,
		Memory:     p.memory,
		PromptUsed: TutorAgentPrompt,
		RAG:        p.rag,
	}, nil
}

func (s *Service) Evaluate(ctx context.Context, req EvaluateRequest) (Evaluation, StudentMemory, error) {
	student, err := s.requireStudentAccess(ctx, req.StudentID)
	if err != nil {
		return Evaluation{}, StudentMemory{}, err
	}
	req.StudentID = student.ID
	course, err := s.requireCourseAccess(ctx, req.CourseID)
	if err != nil {
		return Evaluation{}, StudentMemory{}, err
	}
	if course.ClassID != student.ClassID {
		return Evaluation{}, StudentMemory{}, errors.New("course is not assigned to student class")
	}
	req.CourseID = course.ID
	evaluation := s.evaluatorAgent(ctx, req)
	memory, err := s.store.Load(req.StudentID)
	if err != nil {
		return Evaluation{}, StudentMemory{}, err
	}
	memory.UnderstandingScore = evaluation.UnderstandingScore
	memory.ReflectionLevel = evaluation.ReflectionLevel
	memory.TrustScore = CalculateTrustScore(evaluation.QuestionQuality, evaluation.ExplanationQuality, evaluation.ReflectionDepth)
	memory.CommonErrors = mergeStrings(memory.CommonErrors, evaluation.ErrorTypes)
	if evaluation.UnderstandingScore < 60 {
		memory.KnowledgeWeakness = mergeStrings(memory.KnowledgeWeakness, []string{"当前知识点理解不稳"})
	}
	if evaluation.ReflectionLevel >= 70 {
		memory.ThinkingStyle = "reflective"
	} else if evaluation.ThinkingDepth >= 70 {
		memory.ThinkingStyle = "analytical"
	} else {
		memory.ThinkingStyle = "surface"
	}
	if err := s.store.Save(req.StudentID, memory); err != nil {
		return Evaluation{}, StudentMemory{}, err
	}
	return evaluation, memory, nil
}

func (s *Service) Report(ctx context.Context, req ReportRequest) (Report, error) {
	if strings.TrimSpace(req.CourseID) != "" {
		course, err := s.requireCourseAccess(ctx, req.CourseID)
		if err != nil {
			return Report{}, err
		}
		req.CourseID = course.ID
		if strings.TrimSpace(req.ClassID) == "" {
			req.ClassID = course.ClassID
		}
	}
	if strings.TrimSpace(req.ClassID) != "" {
		class, err := s.requireClassAccess(ctx, req.ClassID)
		if err != nil {
			return Report{}, err
		}
		req.ClassID = class.ID
	}
	if req.StudentID != "" {
		student, err := s.requireStudentAccess(ctx, req.StudentID)
		if err != nil {
			return Report{}, err
		}
		req.StudentID = student.ID
		if req.ClassID != "" && req.ClassID != student.ClassID {
			return Report{}, errors.New("student is not assigned to class")
		}
		memory, err := s.store.Load(req.StudentID)
		if err != nil {
			return Report{}, err
		}
		report := fallbackReport(req, []StudentMemory{memory})
		report.Memory = &memory
		return report, nil
	}
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Report{}, err
	}
	memories := []StudentMemory{}
	for _, student := range dashboard.Students {
		if req.ClassID != "" && student.ClassID != req.ClassID {
			continue
		}
		memory, err := s.store.Load(student.ID)
		if err != nil {
			return Report{}, err
		}
		memories = append(memories, memory)
	}
	return s.reflectorAgent(ctx, req, memories), nil
}

func (s *Service) Workflow(ctx context.Context, req WorkflowRequest) (WorkflowResponse, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return WorkflowResponse{}, err
	}
	if user.Role == "student" {
		if user.StudentID == "" {
			return WorkflowResponse{}, errors.New("student account is not linked to a student profile")
		}
		req.StudentID = user.StudentID
	}
	if req.StudentID == "" {
		student, err := s.defaultStudentForUser(ctx)
		if err != nil {
			return WorkflowResponse{}, err
		}
		req.StudentID = student.ID
	}
	student, err := s.requireStudentAccess(ctx, req.StudentID)
	if err != nil {
		return WorkflowResponse{}, err
	}
	req.StudentID = student.ID
	course, err := s.requireCourseAccess(ctx, req.CourseID)
	if err != nil {
		return WorkflowResponse{}, err
	}
	if course.ClassID != student.ClassID {
		return WorkflowResponse{}, errors.New("course is not assigned to student class")
	}
	req.CourseID = course.ID
	req.ClassID = course.ClassID
	rag := s.retrieveContext(req.StudentInput, req.CourseID, nil)
	knowledge := s.Analyze(ctx, AnalyzeRequest{
		CourseID: req.CourseID,
		Content:  req.LessonContent + "\n" + retrievalContent(rag.Hits),
	})
	tutor, err := s.Chat(ctx, ChatRequest{
		StudentID: req.StudentID,
		CourseID:  req.CourseID,
		Question:  req.StudentInput,
		Context:   knowledge,
		Retrieval: rag.Hits,
	})
	if err != nil {
		return WorkflowResponse{}, err
	}
	rag = tutor.RAG
	evaluation, memory, err := s.Evaluate(ctx, EvaluateRequest{
		StudentID: req.StudentID,
		CourseID:  req.CourseID,
		Question:  req.StudentInput,
		Answer:    req.StudentAnswer,
	})
	if err != nil {
		return WorkflowResponse{}, err
	}
	report, err := s.Report(ctx, ReportRequest{
		StudentID: req.StudentID,
		CourseID:  req.CourseID,
		ClassID:   req.ClassID,
	})
	if err != nil {
		return WorkflowResponse{}, err
	}
	session := LearningSession{
		StudentID:  req.StudentID,
		CourseID:   req.CourseID,
		ClassID:    req.ClassID,
		Input:      req.StudentInput,
		Answer:     req.StudentAnswer,
		Knowledge:  knowledge,
		Evaluation: evaluation,
		TrustScore: memory.TrustScore,
	}
	savedSession, err := s.platform.AddSession(session)
	if err != nil {
		return WorkflowResponse{}, err
	}
	return WorkflowResponse{
		Knowledge:  knowledge,
		Tutor:      tutor,
		Evaluation: evaluation,
		Memory:     memory,
		Report:     report,
		RAG:        rag,
		Session:    &savedSession,
	}, nil
}

func (s *Service) Dashboard() (Dashboard, error) {
	state, err := s.platform.State()
	if err != nil {
		return Dashboard{}, err
	}
	totalTrust := 0
	totalUnderstand := 0
	for _, session := range state.Sessions {
		totalTrust += session.TrustScore
		totalUnderstand += session.Evaluation.UnderstandingScore
	}
	avgTrust := 0
	avgUnderstand := 0
	if len(state.Sessions) > 0 {
		avgTrust = totalTrust / len(state.Sessions)
		avgUnderstand = totalUnderstand / len(state.Sessions)
	}
	problems := []string{}
	for _, session := range state.Sessions {
		problems = mergeStrings(problems, session.Evaluation.ErrorTypes)
	}
	if len(problems) == 0 {
		problems = []string{"暂无明显共性问题"}
	}
	return sanitizeDashboard(Dashboard{
		Schools:           state.Schools,
		Classes:           state.Classes,
		Students:          state.Students,
		Courses:           state.Courses,
		Lessons:           state.Lessons,
		Sessions:          state.Sessions,
		Homeworks:         state.Homeworks,
		HomeworkAttempts:  state.Attempts,
		AuditLogs:         state.Audit,
		Users:             state.Users,
		AverageTrust:      avgTrust,
		AverageUnderstand: avgUnderstand,
		CommonProblems:    problems,
		RetrievalIndex:    s.retrievalStatsFromState(state),
	}), nil
}

func (s *Service) DashboardFor(ctx context.Context) (Dashboard, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return Dashboard{}, err
	}
	dashboard, err := s.Dashboard()
	if err != nil {
		return Dashboard{}, err
	}
	switch user.Role {
	case "admin":
		return dashboard, nil
	case "teacher":
		dashboard.Users = []User{}
		dashboard.Classes = filterClasses(dashboard.Classes, user.ClassIDs)
		dashboard.Schools = filterSchoolsByClasses(dashboard.Schools, dashboard.Classes)
		dashboard.Students = filterStudentsByClasses(dashboard.Students, user.ClassIDs)
		dashboard.Courses = filterCoursesByClasses(dashboard.Courses, user.ClassIDs)
		dashboard.Lessons = filterLessonsByCourses(dashboard.Lessons, dashboard.Courses)
		dashboard.Homeworks = filterHomeworksByClasses(dashboard.Homeworks, user.ClassIDs)
		dashboard.HomeworkAttempts = filterHomeworkAttemptsByHomeworks(dashboard.HomeworkAttempts, dashboard.Homeworks)
		dashboard.Sessions = filterSessionsByClasses(dashboard.Sessions, user.ClassIDs)
		return recalcDashboard(dashboard), nil
	case "student":
		dashboard.Users = []User{}
		dashboard.Classes = filterClasses(dashboard.Classes, user.ClassIDs)
		dashboard.Schools = filterSchoolsByClasses(dashboard.Schools, dashboard.Classes)
		dashboard.Students = filterStudentsByID(dashboard.Students, user.StudentID)
		dashboard.Courses = filterCoursesByClasses(dashboard.Courses, user.ClassIDs)
		dashboard.Lessons = filterLessonsByCourses(dashboard.Lessons, dashboard.Courses)
		dashboard.Homeworks = filterHomeworksByClasses(dashboard.Homeworks, user.ClassIDs)
		dashboard.HomeworkAttempts = filterHomeworkAttemptsByStudent(dashboard.HomeworkAttempts, user.StudentID)
		dashboard.Sessions = filterSessionsByStudent(dashboard.Sessions, user.StudentID)
		dash := recalcDashboard(dashboard)
		if user.StudentID != "" {
			if mem, err := s.store.Load(user.StudentID); err == nil {
				dash.StudentMemory = &mem
			}
		}
		return dash, nil
	default:
		return Dashboard{}, errors.New("permission denied")
	}
}

func mergeStrings(base []string, next []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, item := range append(base, next...) {
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
	}
	return out
}

func fallbackReport(req ReportRequest, memories []StudentMemory) Report {
	common := []string{"学生解释链条不完整", "举例迁移不足", "反思表达偏弱"}
	if len(memories) > 0 {
		common = aggregateProblems(memories)
	}
	return Report{
		Scope:          reportScope(req),
		StudentID:      req.StudentID,
		ClassID:        req.ClassID,
		CommonProblems: common,
		Suggestions:    []string{"增加概念对比提问", "要求学生先解释再求助", "每轮学习加入反思记录"},
		Strategies:     []string{"低 Trust 学生只使用追问", "中 Trust 学生提供提示卡", "高 Trust 学生进入完整解释与迁移任务"},
		GeneratedAt:    nowString(),
		PromptUsed:     ReflectorAgentPrompt,
	}
}

func reportScope(req ReportRequest) string {
	if req.StudentID != "" {
		return "student"
	}
	return "class"
}

func aggregateProblems(memories []StudentMemory) []string {
	counts := map[string]int{}
	for _, memory := range memories {
		for _, item := range memory.CommonErrors {
			counts[item]++
		}
		for _, item := range memory.KnowledgeWeakness {
			counts[item]++
		}
	}
	out := []string{}
	for item := range counts {
		out = append(out, item)
	}
	if len(out) == 0 {
		return []string{"暂无明显共性问题"}
	}
	return out
}

func inferTitle(content string, fallback string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return fallback
	}
	for _, sep := range []string{"\n", "。", "；", ";", "."} {
		if index := strings.Index(content, sep); index > 0 {
			content = content[:index]
			break
		}
	}
	content = strings.TrimSpace(strings.TrimPrefix(content, "#"))
	if len([]rune(content)) > 24 {
		return string([]rune(content)[:24])
	}
	return content
}

func promptForAgentMode(mode string) string {
	switch mode {
	case "tutor", "student", "coach":
		return TutorAgentPrompt
	case "evaluator":
		return EvaluatorAgentPrompt
	case "reflector":
		return ReflectorAgentPrompt
	default:
		return TeacherAgentPrompt + "\n你正在和大学教师对话，围绕《数据库原理》课程生成可写入系统的教学资料。"
	}
}

func (s *Service) buildGuidedHomeworkMessage(ctx context.Context, homework HomeworkTask, step HomeworkStep, answer string, evaluation Evaluation, trust TrustPolicy, completedStep bool, completedHomework bool, nextStep *HomeworkStep, student Student, memory StudentMemory) string {
	fallback := buildGuidedHomeworkMessage(homework, step, answer, evaluation, trust, completedStep, completedHomework, nextStep)
	config, _ := s.platform.LLMConfig()
	if !config.Enabled {
		return fallback
	}
	nextInstruction := "无，当前任务已经完成"
	if nextStep != nil {
		nextInstruction = nextStep.Title + "：" + nextStep.Instruction
	}
	userInput := fmt.Sprintf(`作业标题：%s
作业要求：%s
学生：%s
当前阶段：%s
阶段要求：%s
阶段期望：%s
学生答案：%s
理解评分：%d
表达评分：%d
信任分：%d
常见问题：%s
是否通过当前阶段：%t
是否完成整份作业：%t
下一步：%s

请生成给学生看的阶段反馈。要求：
1. 不直接抛完整标准答案，先指出已做对的点。
2. 给出 2-3 个具体修改建议。
3. 如果未通过，提出一个追问，让学生补充。
4. 如果通过，明确告诉学生进入下一阶段。
5. 控制在 180 字以内。`,
		homework.Title,
		homework.Prompt,
		student.Name,
		step.Title,
		step.Instruction,
		step.Expected,
		answer,
		evaluation.UnderstandingScore,
		evaluation.ExplanationQuality,
		memory.TrustScore,
		strings.Join(memory.CommonErrors, "、"),
		completedStep,
		completedHomework,
		nextInstruction,
	)
	text, err := s.agent.Call(ctx, TutorAgentPrompt, userInput)
	if err != nil || strings.TrimSpace(text) == "" {
		return fallback
	}
	return strings.TrimSpace(text)
}

func buildGuidedHomeworkMessage(homework HomeworkTask, step HomeworkStep, answer string, evaluation Evaluation, trust TrustPolicy, completedStep bool, completedHomework bool, nextStep *HomeworkStep) string {
	prefix := "我不会直接给出标准答案。"
	if completedHomework {
		return prefix + "你已经完成这份分步作业。请最后用一句话总结：你现在如何判断一个外键设计是否合理？"
	}
	if completedStep && nextStep != nil {
		return prefix + "这一步基本通过。进入下一步「" + nextStep.Title + "」：" + nextStep.Instruction
	}
	if trust.CanHint {
		return prefix + "先给你一个提示：围绕「" + step.Expected + "」检查自己的解释。请补充：你这一步的关键依据是什么？"
	}
	return prefix + "请先不要急着要答案。请重新解释「" + step.Title + "」：1）你认为核心概念是什么？2）它和题目有什么关系？3）你能举一个自己的例子吗？"
}

func nextActionLabel(completedStep bool, completedHomework bool, nextStep *HomeworkStep) string {
	if completedHomework {
		return "homework_completed"
	}
	if completedStep && nextStep != nil {
		return "advance_to_next_step"
	}
	return "revise_current_step"
}

func buildHomeworkStepsFromAnalysis(analysis KnowledgeAnalysis, goal string) []HomeworkStep {
	concepts := limitStrings(analysis.Concepts, 3)
	if len(concepts) == 0 {
		concepts = []string{"核心概念"}
	}
	difficulties := limitStrings(analysis.Difficulties, 2)
	if len(difficulties) == 0 {
		difficulties = []string{"容易混淆的地方"}
	}
	mainConcept := concepts[0]
	return []HomeworkStep{
		{Index: 0, Title: "先说想法", Instruction: "请用自己的话说明「" + mainConcept + "」是什么意思，不要照抄定义。", Expected: "能说出核心含义，并能指出它解决什么问题。"},
		{Index: 1, Title: "再举例子", Instruction: "请结合一个你熟悉的场景，举例说明「" + strings.Join(concepts, "、") + "」如何使用。", Expected: "例子要能对应概念，不能只写名词。"},
		{Index: 2, Title: "最后检查", Instruction: "请写出学习这个内容时最容易错的地方，特别注意：" + strings.Join(difficulties, "、") + "。", Expected: "能主动指出误区，并说明如何避免。"},
	}
}

func limitStrings(items []string, n int) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
		if len(out) >= n {
			break
		}
	}
	return out
}

func (s *Service) retrieveContext(query string, courseID string, provided []RetrievalHit) RAGContext {
	stats, err := s.platform.RetrievalStats()
	status := "available"
	if err != nil {
		status = "fallback"
	} else if stats.Status != "" {
		status = stats.Status
	}
	hits := provided
	if len(hits) == 0 {
		hits, err = s.platform.SearchLessons(query, courseID, defaultHitLimit)
		if err != nil {
			hits = []RetrievalHit{}
			status = "fallback"
		}
	}
	if len(hits) == 0 && strings.TrimSpace(query) != "" {
		status = "no_match"
	}
	return RAGContext{Query: strings.TrimSpace(query), IndexStatus: status, Hits: hits}
}

// Search 教师/超管试跑检索：同一套 SearchLessons，带 index 状态与分词结果。
func (s *Service) Search(ctx context.Context, req SearchRequest) (SearchResponse, error) {
	if _, err := RequireRole(ctx, "admin", "teacher"); err != nil {
		return SearchResponse{}, err
	}
	query := strings.TrimSpace(req.Query)
	courseID := strings.TrimSpace(req.CourseID)
	limit := req.Limit
	if limit < 1 {
		limit = defaultHitLimit
	}
	if limit > 20 {
		limit = 20
	}
	if courseID != "" {
		if _, err := s.requireCourseAccess(ctx, courseID); err != nil {
			return SearchResponse{}, err
		}
	}
	stats, err := s.platform.RetrievalStats()
	status := "keyword"
	count := 0
	if err == nil {
		if stats.Status != "" {
			status = stats.Status
		}
		count = stats.IndexedCount
	}
	hits, err := s.platform.SearchLessons(query, courseID, limit)
	if err != nil {
		return SearchResponse{}, err
	}
	if len(hits) == 0 && query != "" {
		status = "no_match"
	}
	return SearchResponse{
		Query:        query,
		CourseID:     courseID,
		IndexStatus:  status,
		IndexedCount: count,
		Hits:         hits,
		Terms:        retrievalTerms(query),
	}, nil
}

func (s *Service) retrievalStatsFromState(state PlatformState) RetrievalIndexStats {
	stats, err := s.platform.RetrievalStats()
	if err == nil {
		return stats
	}
	count := 0
	for _, lesson := range state.Lessons {
		if lesson.Archived {
			continue
		}
		count++
	}
	return RetrievalIndexStats{Status: "fallback", IndexedCount: count}
}

func retrievalContent(hits []RetrievalHit) string {
	if len(hits) == 0 {
		return ""
	}
	parts := []string{}
	for _, hit := range hits {
		parts = append(parts, hit.Title+"："+hit.Snippet)
	}
	return "检索到的课程资料：\n" + strings.Join(parts, "\n")
}

func filterRetrievalByCourse(hits []RetrievalHit, courseID string) []RetrievalHit {
	courseID = strings.TrimSpace(courseID)
	if courseID == "" || len(hits) == 0 {
		return hits
	}
	out := make([]RetrievalHit, 0, len(hits))
	for _, hit := range hits {
		if hit.CourseID == courseID {
			out = append(out, hit)
		}
	}
	return out
}
