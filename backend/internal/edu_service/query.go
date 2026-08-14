package edu_service

import (
	"context"
	"errors"
	"sort"
	"strings"
)

func parseListQuery(page, pageSize int, keyword, role, classID string, archived *bool) ListQuery {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return ListQuery{
		Page:     page,
		PageSize: pageSize,
		Keyword:  strings.TrimSpace(keyword),
		Role:     strings.TrimSpace(role),
		ClassID:  strings.TrimSpace(classID),
		Archived: archived,
	}
}

func paginate[T any](items []T, page, pageSize int) PagedResponse[T] {
	total := len(items)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	if total == 0 {
		start, end = 0, 0
	}
	return PagedResponse[T]{
		Items: items[start:end],
		PageInfo: PageInfo{
			Page:     page,
			PageSize: pageSize,
			Total:    total,
			HasNext:  end < total,
			HasPrev:  start > 0,
		},
	}
}

func (s *Service) ListClassesPage(ctx context.Context, query ListQuery) (PagedResponse[Class], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[Class]{}, err
	}
	items := filterClassesByQuery(dashboard.Classes, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

// ListSchoolsPage 学校列表（仅 admin，requireSchoolAccess 内鉴权）。
func (s *Service) ListSchoolsPage(ctx context.Context, query ListQuery) (PagedResponse[School], error) {
	if _, err := s.requireSchoolAccess(ctx); err != nil {
		return PagedResponse[School]{}, err
	}
	state, err := s.platform.State()
	if err != nil {
		return PagedResponse[School]{}, err
	}
	items := filterSchoolsByQuery(state.Schools, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListCoursesPage(ctx context.Context, query ListQuery) (PagedResponse[Course], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[Course]{}, err
	}
	items := filterCoursesByQuery(dashboard.Courses, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListStudentsPage(ctx context.Context, query ListQuery) (PagedResponse[Student], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[Student]{}, err
	}
	items := filterStudentsByQuery(dashboard.Students, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListLessonsPage(ctx context.Context, query ListQuery) (PagedResponse[Lesson], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[Lesson]{}, err
	}
	lessons := dashboard.Lessons
	if query.ClassID != "" {
		lessons = filterLessonsByCourses(lessons, filterCoursesByClasses(dashboard.Courses, []string{query.ClassID}))
	}
	items := filterLessonsByQuery(lessons, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListSessionsPage(ctx context.Context, query ListQuery) (PagedResponse[LearningSession], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[LearningSession]{}, err
	}
	items := filterSessionsByQuery(dashboard.Sessions, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].CreatedAt > items[j].CreatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListHomeworksPage(ctx context.Context, query ListQuery) (PagedResponse[HomeworkTask], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[HomeworkTask]{}, err
	}
	items := filterHomeworksByQuery(dashboard.Homeworks, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListAuditLogsPage(ctx context.Context, query ListQuery) (PagedResponse[AuditLog], error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return PagedResponse[AuditLog]{}, err
	}
	items := filterAuditByQuery(dashboard.AuditLogs, query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].CreatedAt > items[j].CreatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ListUsersPage(query ListQuery) (PagedResponse[User], error) {
	users, err := s.platform.ListUsers()
	if err != nil {
		return PagedResponse[User]{}, err
	}
	items := filterUsersByQuery(sanitizeUsers(users), query)
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt > items[j].UpdatedAt })
	return paginate(items, query.Page, query.PageSize), nil
}

func (s *Service) ClassByID(ctx context.Context, id string) (Class, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Class{}, err
	}
	for _, item := range dashboard.Classes {
		if item.ID == id {
			return item, nil
		}
	}
	return Class{}, errors.New("class not found")
}

func (s *Service) CourseByID(ctx context.Context, id string) (Course, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Course{}, err
	}
	for _, item := range dashboard.Courses {
		if item.ID == id {
			return item, nil
		}
	}
	return Course{}, errors.New("course not found")
}

func (s *Service) StudentByID(ctx context.Context, id string) (Student, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Student{}, err
	}
	for _, item := range dashboard.Students {
		if item.ID == id {
			return item, nil
		}
	}
	return Student{}, errors.New("student not found")
}

// StudentDetail 在 StudentByID 基础上拼上认知记忆与该生学习轨迹。
// 访问控制沿用 DashboardFor（教师/学生只见自己范围），无需额外校验。
func (s *Service) StudentDetail(ctx context.Context, id string) (StudentDetailResponse, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return StudentDetailResponse{}, err
	}
	var student Student
	found := false
	for _, item := range dashboard.Students {
		if item.ID == id {
			student = item
			found = true
			break
		}
	}
	if !found {
		return StudentDetailResponse{}, errors.New("student not found")
	}

	// 该生学习轨迹（DashboardFor 已按角色限定可见 Sessions）。
	sessions := make([]LearningSession, 0)
	for _, sess := range dashboard.Sessions {
		if sess.StudentID == id {
			sessions = append(sessions, sess)
		}
	}
	sort.SliceStable(sessions, func(i, j int) bool {
		return sessions[i].CreatedAt > sessions[j].CreatedAt
	})

	// 认知记忆：Load 对无记忆学生返回零值，这里判定是否“有真实学习数据”，
	// 无则置 nil 让前端显示占位而非 0 分误导。
	resp := StudentDetailResponse{Student: student, Sessions: sessions}
	if mem, err := s.store.Load(id); err == nil && memoryHasSignal(mem, len(sessions)) {
		m := mem
		resp.Memory = &m
	}
	return resp, nil
}

// memoryHasSignal 判断认知记忆是否含真实学习信号（而非新生零值）。
func memoryHasSignal(mem StudentMemory, sessionCount int) bool {
	return sessionCount > 0 ||
		mem.TrustScore > 0 ||
		mem.UnderstandingScore > 0 ||
		mem.ReflectionLevel > 0 ||
		len(mem.KnowledgeWeakness) > 0 ||
		len(mem.CommonErrors) > 0 ||
		(mem.ThinkingStyle != "" && mem.ThinkingStyle != "unknown")
}

func (s *Service) LessonByID(ctx context.Context, id string) (Lesson, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Lesson{}, err
	}
	for _, item := range dashboard.Lessons {
		if item.ID == id {
			return item, nil
		}
	}
	return Lesson{}, errors.New("lesson not found")
}

func (s *Service) SessionByID(ctx context.Context, id string) (LearningSession, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return LearningSession{}, err
	}
	for _, item := range dashboard.Sessions {
		if item.ID == id {
			return item, nil
		}
	}
	return LearningSession{}, errors.New("session not found")
}

func (s *Service) HomeworkByID(ctx context.Context, id string) (HomeworkTask, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return HomeworkTask{}, err
	}
	for _, item := range dashboard.Homeworks {
		if item.ID == id {
			return item, nil
		}
	}
	return HomeworkTask{}, errors.New("homework not found")
}

func filterSchoolsByQuery(items []School, query ListQuery) []School {
	return filterWith(items, query, func(item School) bool {
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Name, item.Code, query.Keyword)
	})
}

func filterClassesByQuery(items []Class, query ListQuery) []Class {
	return filterWith(items, query, func(item Class) bool {
		if query.ClassID != "" && item.ID != query.ClassID {
			return false
		}
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Name, item.Grade, query.Keyword)
	})
}

func filterCoursesByQuery(items []Course, query ListQuery) []Course {
	return filterWith(items, query, func(item Course) bool {
		if query.ClassID != "" && item.ClassID != query.ClassID {
			return false
		}
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Name, item.ClassID, query.Keyword)
	})
}

func filterStudentsByQuery(items []Student, query ListQuery) []Student {
	return filterWith(items, query, func(item Student) bool {
		if query.ClassID != "" && item.ClassID != query.ClassID {
			return false
		}
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Name, item.ClassID, item.UserID, query.Keyword)
	})
}

func filterLessonsByQuery(items []Lesson, query ListQuery) []Lesson {
	return filterWith(items, query, func(item Lesson) bool {
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Title, item.CourseID, item.Content, query.Keyword)
	})
}

func filterSessionsByQuery(items []LearningSession, query ListQuery) []LearningSession {
	return filterWith(items, query, func(item LearningSession) bool {
		if query.ClassID != "" && item.ClassID != query.ClassID {
			return false
		}
		return containsText(item.ID, item.StudentID, item.CourseID, item.ClassID, item.Input, item.Answer, query.Keyword)
	})
}

func filterHomeworksByQuery(items []HomeworkTask, query ListQuery) []HomeworkTask {
	return filterWith(items, query, func(item HomeworkTask) bool {
		if query.ClassID != "" && item.ClassID != query.ClassID {
			return false
		}
		if query.Archived != nil && item.Archived != *query.Archived {
			return false
		}
		return containsText(item.ID, item.Title, item.CourseID, item.ClassID, item.Prompt, query.Keyword)
	})
}

func filterAuditByQuery(items []AuditLog, query ListQuery) []AuditLog {
	return filterWith(items, query, func(item AuditLog) bool {
		return containsText(item.ID, item.ActorID, item.Action, item.Target, item.Detail, query.Keyword)
	})
}

func filterUsersByQuery(items []User, query ListQuery) []User {
	return filterWith(items, query, func(item User) bool {
		if query.Role != "" && item.Role != query.Role {
			return false
		}
		if query.ClassID != "" && !containsString(item.ClassIDs, query.ClassID) {
			return false
		}
		return containsText(item.ID, item.Username, item.Name, item.Role, query.Keyword)
	})
}

func filterWith[T any](items []T, query ListQuery, keep func(T) bool) []T {
	out := make([]T, 0, len(items))
	for _, item := range items {
		if keep(item) {
			out = append(out, item)
		}
	}
	return out
}

func containsText(values ...string) bool {
	needle := ""
	if len(values) > 0 {
		needle = strings.TrimSpace(values[len(values)-1])
		values = values[:len(values)-1]
	}
	if needle == "" {
		return true
	}
	needle = strings.ToLower(needle)
	for _, value := range values {
		if strings.Contains(strings.ToLower(value), needle) {
			return true
		}
	}
	return false
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
