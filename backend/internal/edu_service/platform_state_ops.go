package edu_service

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

type savePlatformStateFunc func(PlatformState) error

func loginInState(state PlatformState, username string, password string, save savePlatformStateFunc) (LoginResponse, error) {
	for _, user := range state.Users {
		if user.Username == username && user.Active && user.PasswordHash == hashPassword(password) {
			token := randomToken()
			expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)
			state.AuthSessions = append([]AuthSession{{Token: token, UserID: user.ID, ExpiresAt: expiresAt, CreatedAt: nowString()}}, state.AuthSessions...)
			state.Audit = appendAudit(state.Audit, user.ID, "auth.login", user.ID, user.Username)
			if err := save(state); err != nil {
				return LoginResponse{}, err
			}
			return LoginResponse{Token: token, User: user, ExpiresAt: expiresAt}, nil
		}
	}
	return LoginResponse{}, errors.New("invalid username or password")
}

func userByTokenInState(state PlatformState, token string) (User, bool) {
	now := time.Now()
	for _, session := range state.AuthSessions {
		if session.Token != token {
			continue
		}
		expiresAt, err := time.Parse(time.RFC3339, session.ExpiresAt)
		if err != nil || now.After(expiresAt) {
			return User{}, false
		}
		for _, user := range state.Users {
			if user.ID == session.UserID && user.Active {
				return user, true
			}
		}
	}
	return User{}, false
}

func updateLLMConfigInState(state PlatformState, config LLMConfig, actorID string, save savePlatformStateFunc) (LLMConfig, error) {
	if strings.TrimSpace(config.BaseURL) == "" {
		return LLMConfig{}, errors.New("base_url is required")
	}
	if strings.TrimSpace(config.APIKey) == "" || strings.Contains(config.APIKey, "*") {
		config.APIKey = state.LLMConfig.APIKey
	}
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	config.Model = strings.TrimSpace(config.Model)
	if config.Model == "" {
		config.Model = state.LLMConfig.Model
	}
	if config.Model == "" {
		config.Model = "deepseek-v4-flash"
	}
	config.UpdatedAt = nowString()
	state.LLMConfig = config
	state.Audit = appendAudit(state.Audit, actorID, "llm.configure", "llm_config", config.BaseURL)
	if err := save(state); err != nil {
		return LLMConfig{}, err
	}
	return sanitizeLLMConfig(config), nil
}

func upsertUserInState(state PlatformState, req CreateUserRequest, actorID string, save savePlatformStateFunc) (User, error) {
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "teacher"
	}
	user := User{ID: ensureID(req.ID, "user"), Username: strings.TrimSpace(req.Username), Name: strings.TrimSpace(req.Name), Role: role, ClassIDs: req.ClassIDs, StudentID: strings.TrimSpace(req.StudentID), SchoolID: strings.TrimSpace(req.SchoolID), Active: active, PasswordHash: hashPassword(req.Password), CreatedAt: nowString(), UpdatedAt: nowString()}
	if user.Username == "" || req.Password == "" {
		return User{}, errors.New("username and password are required")
	}
	if user.Name == "" {
		user.Name = user.Username
	}
	for index, existing := range state.Users {
		if existing.Username == user.Username && existing.ID != user.ID {
			return User{}, fmt.Errorf("username already exists: %s", user.Username)
		}
		if existing.ID == user.ID {
			if req.Password == "" {
				user.PasswordHash = existing.PasswordHash
			}
			if user.SchoolID == "" {
				user.SchoolID = existing.SchoolID
			}
			user.CreatedAt = existing.CreatedAt
			state.Users[index] = user
			state.Audit = appendAudit(state.Audit, actorID, "user.upsert", user.ID, user.Username)
			return user, save(state)
		}
	}
	state.Users = append(state.Users, user)
	state.Audit = appendAudit(state.Audit, actorID, "user.create", user.ID, user.Username)
	return user, save(state)
}

func updateUserInState(state PlatformState, req UpdateUserRequest, actorID string, save savePlatformStateFunc) (User, error) {
	for index, user := range state.Users {
		if user.ID != req.ID {
			continue
		}
		if req.Name != "" {
			user.Name = req.Name
		}
		if req.Role != "" {
			user.Role = req.Role
		}
		if req.ClassIDs != nil {
			user.ClassIDs = req.ClassIDs
		}
		if req.StudentID != "" {
			user.StudentID = req.StudentID
		}
		if req.SchoolID != "" {
			user.SchoolID = strings.TrimSpace(req.SchoolID)
		}
		if req.Active != nil {
			user.Active = *req.Active
		}
		if req.Password != "" {
			user.PasswordHash = hashPassword(req.Password)
		}
		user.UpdatedAt = nowString()
		state.Users[index] = user
		state.Audit = appendAudit(state.Audit, actorID, "user.update", user.ID, user.Username)
		return user, save(state)
	}
	return User{}, errors.New("user not found")
}

func updateUserImageInState(state PlatformState, userID string, kind string, url string, actorID string, save savePlatformStateFunc) (User, error) {
	for index, user := range state.Users {
		if user.ID != userID {
			continue
		}
		if kind == "avatar" {
			user.AvatarURL = url
		} else {
			user.BackgroundURL = url
		}
		user.UpdatedAt = nowString()
		state.Users[index] = user
		state.Audit = appendAudit(state.Audit, actorID, "user."+kind+".update", user.ID, user.Username)
		return user, save(state)
	}
	return User{}, errors.New("user not found")
}

func upsertSchoolInState(state PlatformState, req CreateSchoolRequest, actorID string, save savePlatformStateFunc) (School, error) {
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	school := School{ID: ensureID(req.ID, "school"), Name: strings.TrimSpace(req.Name), Code: strings.TrimSpace(req.Code), Archived: archived, CreatedAt: nowString(), UpdatedAt: nowString()}
	for index, existing := range state.Schools {
		if existing.ID == school.ID {
			if school.Name == "" {
				school.Name = existing.Name
			}
			if school.Code == "" {
				school.Code = existing.Code
			}
			school.CreatedAt = existing.CreatedAt
			if req.Archived == nil {
				school.Archived = existing.Archived
			}
			state.Schools[index] = school
			state.Audit = appendAudit(state.Audit, actorID, "school.update", school.ID, school.Name)
			return school, save(state)
		}
	}
	if school.Name == "" {
		school.Name = "默认学校"
	}
	state.Schools = append(state.Schools, school)
	state.Audit = appendAudit(state.Audit, actorID, "school.create", school.ID, school.Name)
	return school, save(state)
}

// appendAuditInState 供批量操作补一条汇总审计（如 student_import）。
func appendAuditInState(state PlatformState, actorID string, action string, target string, detail string, save savePlatformStateFunc) error {
	state.Audit = appendAudit(state.Audit, actorID, action, target, detail)
	return save(state)
}

func upsertClassInState(state PlatformState, req CreateClassRequest, actorID string, save savePlatformStateFunc) (Class, error) {
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	class := Class{ID: ensureID(req.ID, "class"), Name: strings.TrimSpace(req.Name), Grade: strings.TrimSpace(req.Grade), TeacherID: strings.TrimSpace(req.TeacherID), SchoolID: strings.TrimSpace(req.SchoolID), Archived: archived, CreatedAt: nowString(), UpdatedAt: nowString()}
	for index, existing := range state.Classes {
		if existing.ID == class.ID {
			if class.Name == "" {
				class.Name = existing.Name
			}
			if class.Grade == "" {
				class.Grade = existing.Grade
			}
			if class.TeacherID == "" {
				class.TeacherID = existing.TeacherID
			}
			if class.SchoolID == "" {
				class.SchoolID = existing.SchoolID
			}
			class.CreatedAt = existing.CreatedAt
			if req.Archived == nil {
				class.Archived = existing.Archived
			}
			state.Classes[index] = class
			state.Audit = appendAudit(state.Audit, actorID, "class.update", class.ID, class.Name)
			return class, save(state)
		}
	}
	if class.Name == "" {
		class.Name = "默认班级"
	}
	state.Classes = append(state.Classes, class)
	state.Audit = appendAudit(state.Audit, actorID, "class.create", class.ID, class.Name)
	return class, save(state)
}

func upsertStudentInState(state PlatformState, req CreateStudentRequest, actorID string, save savePlatformStateFunc) (Student, error) {
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	student := Student{ID: ensureID(req.ID, "student"), Name: strings.TrimSpace(req.Name), ClassID: strings.TrimSpace(req.ClassID), UserID: strings.TrimSpace(req.UserID), Archived: archived, CreatedAt: nowString(), UpdatedAt: nowString()}
	for index, existing := range state.Students {
		if existing.ID == student.ID {
			if student.Name == "" {
				student.Name = existing.Name
			}
			if student.ClassID == "" {
				student.ClassID = existing.ClassID
			}
			if student.UserID == "" {
				student.UserID = existing.UserID
			}
			student.CreatedAt = existing.CreatedAt
			if req.Archived == nil {
				student.Archived = existing.Archived
			}
			state.Students[index] = student
			state.Audit = appendAudit(state.Audit, actorID, "student.update", student.ID, student.Name)
			return student, save(state)
		}
	}
	if student.Name == "" {
		student.Name = student.ID
	}
	state.Students = append(state.Students, student)
	state.Audit = appendAudit(state.Audit, actorID, "student.create", student.ID, student.Name)
	return student, save(state)
}

func upsertCourseInState(state PlatformState, req CreateCourseRequest, actorID string, save savePlatformStateFunc) (Course, error) {
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	course := Course{ID: ensureID(req.ID, "course"), Name: strings.TrimSpace(req.Name), ClassID: strings.TrimSpace(req.ClassID), Archived: archived, CreatedAt: nowString(), UpdatedAt: nowString()}
	for index, existing := range state.Courses {
		if existing.ID == course.ID {
			if course.Name == "" {
				course.Name = existing.Name
			}
			if course.ClassID == "" {
				course.ClassID = existing.ClassID
			}
			course.CreatedAt = existing.CreatedAt
			if req.Archived == nil {
				course.Archived = existing.Archived
			}
			state.Courses[index] = course
			state.Audit = appendAudit(state.Audit, actorID, "course.update", course.ID, course.Name)
			return course, save(state)
		}
	}
	if course.Name == "" {
		course.Name = "未命名课程"
	}
	state.Courses = append(state.Courses, course)
	state.Audit = appendAudit(state.Audit, actorID, "course.create", course.ID, course.Name)
	return course, save(state)
}

func upsertLessonInState(state PlatformState, req CreateLessonRequest, analysis KnowledgeAnalysis, fileName string, actorID string, save savePlatformStateFunc) (Lesson, error) {
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	lesson := Lesson{ID: ensureID(req.ID, "lesson"), CourseID: strings.TrimSpace(req.CourseID), Title: strings.TrimSpace(req.Title), Content: strings.TrimSpace(req.Content), FileName: fileName, Analysis: analysis, AnalysisDone: true, Archived: archived, CreatedAt: nowString(), UpdatedAt: nowString()}
	for index, existing := range state.Lessons {
		if existing.ID == lesson.ID {
			if lesson.CourseID == "" {
				lesson.CourseID = existing.CourseID
			}
			if lesson.Title == "" {
				lesson.Title = existing.Title
			}
			if lesson.Content == "" {
				lesson.Content = existing.Content
			}
			if lesson.FileName == "" {
				lesson.FileName = existing.FileName
			}
			if req.Archived == nil {
				lesson.Archived = existing.Archived
			}
			if len(analysis.Concepts) == 0 && len(analysis.Difficulties) == 0 && len(analysis.LearningPath) == 0 {
				lesson.Analysis = existing.Analysis
				lesson.AnalysisDone = existing.AnalysisDone
			}
			lesson.CreatedAt = existing.CreatedAt
			state.Lessons[index] = lesson
			state.Audit = appendAudit(state.Audit, actorID, "lesson.update", lesson.ID, lesson.Title)
			return lesson, save(state)
		}
	}
	if lesson.Title == "" {
		lesson.Title = "未命名教案"
	}
	state.Lessons = append(state.Lessons, lesson)
	state.Audit = appendAudit(state.Audit, actorID, "lesson.analyze", lesson.ID, lesson.Title)
	return lesson, save(state)
}

func upsertHomeworkInState(state PlatformState, req CreateHomeworkRequest, actorID string, save savePlatformStateFunc) (HomeworkTask, error) {
	published := true
	if req.Published != nil {
		published = *req.Published
	}
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	task := HomeworkTask{ID: ensureID(req.ID, "homework"), CourseID: strings.TrimSpace(req.CourseID), ClassID: strings.TrimSpace(req.ClassID), LessonID: strings.TrimSpace(req.LessonID), Title: strings.TrimSpace(req.Title), Prompt: strings.TrimSpace(req.Prompt), Steps: normalizeHomeworkSteps(req.Steps, req.Prompt), Published: published, Archived: archived, CreatedBy: actorID, CreatedAt: nowString(), UpdatedAt: nowString()}
	if task.CourseID == "" {
		task.CourseID = "course_db"
	}
	if task.ClassID == "" {
		task.ClassID = "class_cs_2026"
	}
	if task.Title == "" {
		task.Title = inferTitle(task.Prompt, "数据库原理分步作业")
	}
	if task.Prompt == "" {
		task.Prompt = "请围绕数据库原理完成分步解释、举例和反思。"
	}
	if task.Published {
		task.PublishedAt = nowString()
	}
	for index, existing := range state.Homeworks {
		if existing.ID != task.ID {
			continue
		}
		if task.LessonID == "" {
			task.LessonID = existing.LessonID
		}
		if task.CreatedBy == "" {
			task.CreatedBy = existing.CreatedBy
		}
		task.CreatedAt = existing.CreatedAt
		if req.Published == nil {
			task.Published = existing.Published
			task.PublishedAt = existing.PublishedAt
		}
		if req.Archived == nil {
			task.Archived = existing.Archived
		}
		state.Homeworks[index] = task
		state.Audit = appendAudit(state.Audit, actorID, "homework.update", task.ID, task.Title)
		return task, save(state)
	}
	state.Homeworks = append([]HomeworkTask{task}, state.Homeworks...)
	state.Audit = appendAudit(state.Audit, actorID, "homework.create", task.ID, task.Title)
	return task, save(state)
}

func addHomeworkAttemptInState(state PlatformState, attempt HomeworkAttempt, save savePlatformStateFunc) (HomeworkAttempt, error) {
	attempt.ID = ensureID(attempt.ID, "attempt")
	attempt.CreatedAt = nowString()
	state.Attempts = append([]HomeworkAttempt{attempt}, state.Attempts...)
	if len(state.Attempts) > 1000 {
		state.Attempts = state.Attempts[:1000]
	}
	state.Audit = appendAudit(state.Audit, attempt.StudentID, "homework.attempt", attempt.HomeworkID, attempt.NextRequiredAction)
	return attempt, save(state)
}

func resetHomeworkAttemptsInState(state PlatformState, homeworkID string, studentID string, actorID string, save savePlatformStateFunc) (int, error) {
	homeworkID = strings.TrimSpace(homeworkID)
	studentID = strings.TrimSpace(studentID)
	if homeworkID == "" {
		return 0, errors.New("homework_id is required")
	}
	kept := make([]HomeworkAttempt, 0, len(state.Attempts))
	deleted := 0
	for _, attempt := range state.Attempts {
		if attempt.HomeworkID == homeworkID && (studentID == "" || attempt.StudentID == studentID) {
			deleted++
			continue
		}
		kept = append(kept, attempt)
	}
	state.Attempts = kept
	state.Audit = appendAudit(state.Audit, actorID, "homework.attempts.reset", homeworkID, fmt.Sprintf("deleted=%d student=%s", deleted, studentID))
	return deleted, save(state)
}

func addSessionInState(state PlatformState, session LearningSession, save savePlatformStateFunc) (LearningSession, error) {
	session.ID = ensureID(session.ID, "session")
	session.CreatedAt = nowString()
	state.Sessions = append([]LearningSession{session}, state.Sessions...)
	if len(state.Sessions) > 500 {
		state.Sessions = state.Sessions[:500]
	}
	state.Audit = appendAudit(state.Audit, session.StudentID, "workflow.complete", session.ID, session.Input)
	return session, save(state)
}

const (
	maxConversationsPerOwner = 50
	maxMessagesPerConversation = 200
)

// upsertConversationInState 按 (ID, ownerID) 命中则更新，否则新建；归属恒为 ownerID。
// 每用户最多保留 maxConversationsPerOwner 条（超出淘汰最旧），单会话消息封顶。
func upsertConversationInState(state PlatformState, req SaveConversationRequest, ownerID string, save savePlatformStateFunc) (Conversation, error) {
	if strings.TrimSpace(ownerID) == "" {
		return Conversation{}, errors.New("missing owner")
	}
	messages := req.Messages
	if len(messages) > maxMessagesPerConversation {
		messages = messages[len(messages)-maxMessagesPerConversation:]
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "未命名对话"
	}
	now := nowString()

	// 更新已存在的同属主会话。
	if req.ID != "" {
		for index, conv := range state.Conversations {
			if conv.ID == req.ID && conv.OwnerID == ownerID {
				conv.Title = title
				if req.Mode != "" {
					conv.Mode = req.Mode
				}
				conv.Messages = messages
				conv.UpdatedAt = now
				state.Conversations[index] = conv
				return conv, save(state)
			}
		}
	}

	// 新建。
	conv := Conversation{
		ID:        ensureID(req.ID, "conv"),
		OwnerID:   ownerID,
		Title:     title,
		Mode:      req.Mode,
		Messages:  messages,
		CreatedAt: now,
		UpdatedAt: now,
	}
	state.Conversations = append(state.Conversations, conv)
	state.Conversations = pruneConversations(state.Conversations, ownerID)
	state.Audit = appendAudit(state.Audit, ownerID, "conversation.save", conv.ID, conv.Title)
	return conv, save(state)
}

// deleteConversationInState 仅删除属主自己的会话。
func deleteConversationInState(state PlatformState, id string, ownerID string, save savePlatformStateFunc) error {
	kept := make([]Conversation, 0, len(state.Conversations))
	found := false
	for _, conv := range state.Conversations {
		if conv.ID == id && conv.OwnerID == ownerID {
			found = true
			continue
		}
		kept = append(kept, conv)
	}
	if !found {
		return errors.New("conversation not found")
	}
	state.Conversations = kept
	state.Audit = appendAudit(state.Audit, ownerID, "conversation.delete", id, "")
	return save(state)
}

// listConversationsForOwner 返回某属主的全部会话，按 UpdatedAt 倒序。
func listConversationsForOwner(state PlatformState, ownerID string) []Conversation {
	owned := make([]Conversation, 0)
	for _, conv := range state.Conversations {
		if conv.OwnerID == ownerID {
			owned = append(owned, conv)
		}
	}
	sort.SliceStable(owned, func(i, j int) bool { return owned[i].UpdatedAt > owned[j].UpdatedAt })
	return owned
}

// conversationForOwner 按 ID 取某属主的单个会话（含 messages）。
func conversationForOwner(state PlatformState, id string, ownerID string) (Conversation, error) {
	for _, conv := range state.Conversations {
		if conv.ID == id && conv.OwnerID == ownerID {
			return conv, nil
		}
	}
	return Conversation{}, errors.New("conversation not found")
}

// pruneConversations 保证某属主的会话不超过上限（按 UpdatedAt 淘汰最旧），不动其他属主。
func pruneConversations(all []Conversation, ownerID string) []Conversation {
	owned := make([]Conversation, 0)
	others := make([]Conversation, 0, len(all))
	for _, conv := range all {
		if conv.OwnerID == ownerID {
			owned = append(owned, conv)
		} else {
			others = append(others, conv)
		}
	}
	if len(owned) <= maxConversationsPerOwner {
		return all
	}
	sort.SliceStable(owned, func(i, j int) bool { return owned[i].UpdatedAt > owned[j].UpdatedAt })
	owned = owned[:maxConversationsPerOwner]
	return append(others, owned...)
}
