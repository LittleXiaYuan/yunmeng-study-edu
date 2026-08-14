package edu_service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type fakeAgentClient struct{}

func (fakeAgentClient) Call(context.Context, string, string) (string, error) {
	return "", errors.New("agent disabled in test")
}

func (fakeAgentClient) UploadKnowledge(context.Context, AnalyzeRequest) (KnowledgeAnalysis, error) {
	return KnowledgeAnalysis{}, errors.New("agent disabled in test")
}

func testService(t *testing.T) *Service {
	t.Helper()
	dir := t.TempDir()
	memory, err := NewJSONMemoryStore(dir)
	if err != nil {
		t.Fatalf("memory store: %v", err)
	}
	platform, err := NewPlatformStore(dir)
	if err != nil {
		t.Fatalf("platform store: %v", err)
	}
	return NewService(memory, platform, fakeAgentClient{}, dir)
}

func userContext(user User) context.Context {
	return context.WithValue(context.Background(), requestUserKey{}, user)
}

func TestTeacherDashboardAndLessonWritesAreClassScoped(t *testing.T) {
	service := testService(t)
	admin := userContext(User{ID: "admin_test", Role: "admin", Active: true})
	teacherA := userContext(User{ID: "teacher_a", Role: "teacher", ClassIDs: []string{"class_cs_2026"}, Active: true})
	teacherB := userContext(User{ID: "teacher_b", Role: "teacher", ClassIDs: []string{"class_other"}, Active: true})

	if _, err := service.CreateClass(admin, CreateClassRequest{ID: "class_other", Name: "另一个班级"}); err != nil {
		t.Fatalf("create other class: %v", err)
	}
	if _, err := service.CreateCourse(admin, CreateCourseRequest{ID: "course_other", Name: "隔离课程", ClassID: "class_other"}); err != nil {
		t.Fatalf("create other course: %v", err)
	}
	if _, err := service.CreateStudent(admin, CreateStudentRequest{ID: "student_other", Name: "学生B", ClassID: "class_other"}); err != nil {
		t.Fatalf("create other student: %v", err)
	}
	if _, err := service.CreateLesson(admin, CreateLessonRequest{ID: "lesson_other", CourseID: "course_other", Title: "其他班级资料", Content: "其他班级专属内容"}, ""); err != nil {
		t.Fatalf("create other lesson: %v", err)
	}

	dashboardA, err := service.DashboardFor(teacherA)
	if err != nil {
		t.Fatalf("dashboard teacher A: %v", err)
	}
	if containsCourse(dashboardA.Courses, "course_other") || containsLesson(dashboardA.Lessons, "lesson_other") {
		t.Fatalf("teacher A can see another class data: courses=%v lessons=%v", dashboardA.Courses, dashboardA.Lessons)
	}

	dashboardB, err := service.DashboardFor(teacherB)
	if err != nil {
		t.Fatalf("dashboard teacher B: %v", err)
	}
	if containsCourse(dashboardB.Courses, "course_db") || containsLesson(dashboardB.Lessons, "lesson_001") {
		t.Fatalf("teacher B can see seed class data: courses=%v lessons=%v", dashboardB.Courses, dashboardB.Lessons)
	}

	if _, err := service.CreateLesson(teacherA, CreateLessonRequest{CourseID: "course_other", Title: "越权导入", Content: "不应入库"}, ""); err == nil {
		t.Fatal("teacher A created a lesson in another class course")
	}
}

func TestChatRetrievalAndStudentMemoryAreClassScoped(t *testing.T) {
	service := testService(t)
	admin := userContext(User{ID: "admin_test", Role: "admin", Active: true})
	teacherA := userContext(User{ID: "teacher_a", Role: "teacher", ClassIDs: []string{"class_cs_2026"}, Active: true})

	if _, err := service.CreateClass(admin, CreateClassRequest{ID: "class_other", Name: "另一个班级"}); err != nil {
		t.Fatalf("create other class: %v", err)
	}
	if _, err := service.CreateCourse(admin, CreateCourseRequest{ID: "course_other", Name: "隔离课程", ClassID: "class_other"}); err != nil {
		t.Fatalf("create other course: %v", err)
	}
	if _, err := service.CreateStudent(admin, CreateStudentRequest{ID: "student_other", Name: "学生B", ClassID: "class_other"}); err != nil {
		t.Fatalf("create other student: %v", err)
	}

	if _, err := service.Chat(teacherA, ChatRequest{StudentID: "student_other", CourseID: "course_other", Question: "能看到吗"}); err == nil {
		t.Fatal("teacher A chatted against another class student/course")
	}

	resp, err := service.Chat(teacherA, ChatRequest{
		StudentID: "student_001",
		CourseID:  "course_db",
		Question:  "主键是什么",
		Retrieval: []RetrievalHit{
			{LessonID: "lesson_other", CourseID: "course_other", Title: "其他班级资料", Snippet: "不应出现", Score: 99},
			{LessonID: "lesson_001", CourseID: "course_db", Title: "本班资料", Snippet: "可以出现", Score: 10},
		},
	})
	if err != nil {
		t.Fatalf("chat own class: %v", err)
	}
	if len(resp.RAG.Hits) != 1 || resp.RAG.Hits[0].CourseID != "course_db" {
		t.Fatalf("retrieval hits were not filtered by course: %#v", resp.RAG.Hits)
	}
}

func containsCourse(items []Course, id string) bool {
	for _, item := range items {
		if item.ID == id {
			return true
		}
	}
	return false
}

func containsLesson(items []Lesson, id string) bool {
	for _, item := range items {
		if item.ID == id {
			return true
		}
	}
	return false
}

func TestSchoolManagementIsAdminOnly(t *testing.T) {
	service := testService(t)
	admin := userContext(User{ID: "admin_test", Role: "admin", Active: true})
	teacherA := userContext(User{ID: "teacher_a", Role: "teacher", ClassIDs: []string{"class_cs_2026"}, Active: true})
	teacherB := userContext(User{ID: "teacher_b", Role: "teacher", ClassIDs: []string{"class_other"}, Active: true})
	student := userContext(User{ID: "student_user_001", Role: "student", ClassIDs: []string{"class_cs_2026"}, StudentID: "student_001", Active: true})

	// 种子学校已就位，且种子班级/用户已归属 school_demo。
	page, err := service.ListSchoolsPage(admin, ListQuery{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("admin list schools: %v", err)
	}
	if !containsSchool(page.Items, "school_demo") {
		t.Fatalf("seed school school_demo missing: %#v", page.Items)
	}
	seedClass, err := service.ClassByID(admin, "class_cs_2026")
	if err != nil {
		t.Fatalf("seed class: %v", err)
	}
	if seedClass.SchoolID != "school_demo" {
		t.Fatalf("seed class not linked to school_demo: %#v", seedClass)
	}

	// 非 admin 一律拒绝（组织管理端点 admin 专属）。
	if _, err := service.CreateSchool(teacherA, CreateSchoolRequest{Name: "越权学校"}); err == nil {
		t.Fatal("teacher created a school")
	}
	if _, err := service.CreateSchool(student, CreateSchoolRequest{Name: "越权学校"}); err == nil {
		t.Fatal("student created a school")
	}
	if _, err := service.ListSchoolsPage(teacherA, ListQuery{Page: 1, PageSize: 20}); err == nil {
		t.Fatal("teacher listed schools")
	}
	if _, err := service.ListSchoolsPage(student, ListQuery{Page: 1, PageSize: 20}); err == nil {
		t.Fatal("student listed schools")
	}

	// upsert：无 id 新建、有 id 更新；school_id 可显式指定到非默认学校。
	if _, err := service.CreateSchool(admin, CreateSchoolRequest{ID: "school_two", Name: "云元第二大学", Code: "YUNYUAN-2"}); err != nil {
		t.Fatalf("create second school: %v", err)
	}
	if _, err := service.CreateClass(admin, CreateClassRequest{ID: "class_other", Name: "他校班级", SchoolID: "school_two"}); err != nil {
		t.Fatalf("create class in second school: %v", err)
	}

	// Dashboard school 维度隔离：teacher 只看到自己班级所属的学校。
	dashboardA, err := service.DashboardFor(teacherA)
	if err != nil {
		t.Fatalf("dashboard teacher A: %v", err)
	}
	if containsSchool(dashboardA.Schools, "school_two") {
		t.Fatalf("teacher A can see another school's data: %#v", dashboardA.Schools)
	}
	dashboardB, err := service.DashboardFor(teacherB)
	if err != nil {
		t.Fatalf("dashboard teacher B: %v", err)
	}
	if containsSchool(dashboardB.Schools, "school_demo") {
		t.Fatalf("teacher B can see demo school data: %#v", dashboardB.Schools)
	}

	// 归档仍有未归档班级的学校：仅标记、不级联，并返回提示。
	archived := true
	resp, err := service.CreateSchool(admin, CreateSchoolRequest{ID: "school_two", Archived: &archived})
	if err != nil {
		t.Fatalf("archive school_two: %v", err)
	}
	if !resp.Archived {
		t.Fatal("school_two was not archived")
	}
	if strings.TrimSpace(resp.Message) == "" {
		t.Fatal("expected archive hint for school with active classes")
	}
	otherClass, err := service.ClassByID(admin, "class_other")
	if err != nil {
		t.Fatalf("class_other: %v", err)
	}
	if otherClass.Archived {
		t.Fatal("archiving school cascaded into its classes")
	}
}

func TestStudentImportAccessAndPartialFailure(t *testing.T) {
	service := testService(t)
	admin := userContext(User{ID: "admin_test", Role: "admin", Active: true})
	teacherA := userContext(User{ID: "teacher_a", Role: "teacher", ClassIDs: []string{"class_cs_2026"}, Active: true})
	teacherB := userContext(User{ID: "teacher_b", Role: "teacher", ClassIDs: []string{"class_other"}, Active: true})
	student := userContext(User{ID: "student_user_001", Role: "student", ClassIDs: []string{"class_cs_2026"}, StudentID: "student_001", Active: true})

	if _, err := service.CreateClass(admin, CreateClassRequest{ID: "class_other", Name: "另一个班级"}); err != nil {
		t.Fatalf("create other class: %v", err)
	}

	req := ImportStudentsRequest{
		ClassID:    "class_cs_2026",
		CreateUser: true,
		Rows: []ImportStudentRow{
			{Name: "张三", Username: "stu01", Password: "123456"},
			{Name: "李四", Username: "stu02", Password: "123456"},
			{Name: "王五", Username: "stu01", Password: "123456"},
		},
	}

	// teacher 向不属于自己的班级导入被拒。
	if _, err := service.ImportStudents(teacherB, req); err == nil {
		t.Fatal("teacher B imported students into a class they do not own")
	}
	// student 角色调用导入端点被拒。
	if _, err := service.ImportStudents(student, req); err == nil {
		t.Fatal("student imported students")
	}

	// 正常路径：2 行成功，1 行用户名重复失败，错误文案非空。
	resp, err := service.ImportStudents(teacherA, req)
	if err != nil {
		t.Fatalf("import students: %v", err)
	}
	if resp.Created != 2 || resp.Failed != 1 {
		t.Fatalf("unexpected import result: created=%d failed=%d errors=%v", resp.Created, resp.Failed, resp.Errors)
	}
	if len(resp.Errors) != 1 || strings.TrimSpace(resp.Errors[0]) == "" {
		t.Fatalf("expected one non-empty error message: %#v", resp.Errors)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 imported students: %#v", resp.Items)
	}
	for _, item := range resp.Items {
		if item.ClassID != "class_cs_2026" || item.UserID == "" {
			t.Fatalf("imported student missing class/user link: %#v", item)
		}
	}

	// admin 任意班可导入。
	adminResp, err := service.ImportStudents(admin, ImportStudentsRequest{
		ClassID: "class_other",
		Rows:    []ImportStudentRow{{Name: "学生C"}},
	})
	if err != nil {
		t.Fatalf("admin import into other class: %v", err)
	}
	if adminResp.Created != 1 || adminResp.Failed != 0 {
		t.Fatalf("unexpected admin import result: %#v", adminResp)
	}

	// 审计：student_import 动作已写入且含数量。
	logs, err := service.ListAuditLogs(admin)
	if err != nil {
		t.Fatalf("list audit logs: %v", err)
	}
	foundAudit := false
	for _, log := range logs {
		if log.Action == "student_import" && strings.Contains(log.Detail, "created=") {
			foundAudit = true
		}
	}
	if !foundAudit {
		t.Fatal("student_import audit log missing")
	}
}

// 旧数据迁移：没有 schools 的历史 platform_state.json 加载时自动补默认学校并回填 school_id。
func TestSchoolMigrationBackfillsLegacyState(t *testing.T) {
	dir := t.TempDir()
	legacy := `{"classes":[{"id":"class_legacy","name":"旧班级","created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}],"users":[{"id":"user_legacy","username":"legacy_teacher","name":"旧教师","role":"teacher","class_ids":["class_legacy"],"active":true,"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}]}`
	if err := os.WriteFile(filepath.Join(dir, "platform_state.json"), []byte(legacy), 0644); err != nil {
		t.Fatalf("write legacy state: %v", err)
	}
	store, err := NewPlatformStore(dir)
	if err != nil {
		t.Fatalf("platform store: %v", err)
	}
	state, err := store.State()
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if !containsSchool(state.Schools, "school_demo") {
		t.Fatalf("default school not created for legacy state: %#v", state.Schools)
	}
	for _, class := range state.Classes {
		if class.SchoolID == "" {
			t.Fatalf("legacy class not backfilled with school_id: %#v", class)
		}
	}
	for _, user := range state.Users {
		if user.SchoolID == "" {
			t.Fatalf("legacy user not backfilled with school_id: %#v", user)
		}
	}
}

func containsSchool(items []School, id string) bool {
	for _, item := range items {
		if item.ID == id {
			return true
		}
	}
	return false
}
