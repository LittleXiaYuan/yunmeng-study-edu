package edu_service

import (
	"context"
	"errors"
	"strings"
)

func (s *Service) requireClassAccess(ctx context.Context, classID string) (Class, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return Class{}, err
	}
	classID = strings.TrimSpace(classID)
	if classID == "" {
		return Class{}, errors.New("class_id is required")
	}
	state, err := s.platform.State()
	if err != nil {
		return Class{}, err
	}
	for _, class := range state.Classes {
		if class.ID != classID {
			continue
		}
		if user.Role != "admin" && !containsString(user.ClassIDs, class.ID) {
			return Class{}, errors.New("permission denied: class is not assigned to current user")
		}
		return class, nil
	}
	return Class{}, errors.New("class not found")
}

// requireSchoolAccess 学校/组织管理仅 admin 可用：admin 直通，非 admin 一律拒绝。
func (s *Service) requireSchoolAccess(ctx context.Context) (User, error) {
	return RequireRole(ctx, "admin")
}

func (s *Service) requireCourseAccess(ctx context.Context, courseID string) (Course, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return Course{}, err
	}
	courseID = strings.TrimSpace(courseID)
	if courseID == "" {
		return s.defaultCourseForUser(ctx)
	}
	state, err := s.platform.State()
	if err != nil {
		return Course{}, err
	}
	for _, course := range state.Courses {
		if course.ID != courseID {
			continue
		}
		if user.Role != "admin" && !containsString(user.ClassIDs, course.ClassID) {
			return Course{}, errors.New("permission denied: course is not assigned to current user")
		}
		return course, nil
	}
	return Course{}, errors.New("course not found")
}

func (s *Service) defaultCourseForUser(ctx context.Context) (Course, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Course{}, err
	}
	for _, course := range dashboard.Courses {
		if !course.Archived {
			return course, nil
		}
	}
	return Course{}, errors.New("no accessible course")
}

func (s *Service) defaultClassForUser(ctx context.Context) (Class, error) {
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Class{}, err
	}
	for _, class := range dashboard.Classes {
		if !class.Archived {
			return class, nil
		}
	}
	return Class{}, errors.New("no accessible class")
}

func (s *Service) requireStudentAccess(ctx context.Context, studentID string) (Student, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return Student{}, err
	}
	studentID = strings.TrimSpace(studentID)
	if user.Role == "student" {
		if user.StudentID == "" {
			return Student{}, errors.New("student account is not linked to a student profile")
		}
		studentID = user.StudentID
	}
	if studentID == "" {
		return Student{}, errors.New("student_id is required")
	}
	state, err := s.platform.State()
	if err != nil {
		return Student{}, err
	}
	for _, student := range state.Students {
		if student.ID != studentID {
			continue
		}
		if user.Role != "admin" && !containsString(user.ClassIDs, student.ClassID) {
			return Student{}, errors.New("permission denied: student is not assigned to current user")
		}
		return student, nil
	}
	return Student{}, errors.New("student not found")
}

func (s *Service) defaultStudentForUser(ctx context.Context) (Student, error) {
	user, err := RequireRole(ctx, "admin", "teacher", "student")
	if err != nil {
		return Student{}, err
	}
	if user.Role == "student" {
		return s.requireStudentAccess(ctx, user.StudentID)
	}
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Student{}, err
	}
	for _, student := range dashboard.Students {
		if !student.Archived {
			return student, nil
		}
	}
	return Student{}, errors.New("no accessible student")
}

func (s *Service) requireHomeworkAccess(ctx context.Context, homeworkID string) (HomeworkTask, error) {
	homeworkID = strings.TrimSpace(homeworkID)
	if homeworkID == "" {
		return HomeworkTask{}, errors.New("homework_id is required")
	}
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return HomeworkTask{}, err
	}
	for _, homework := range dashboard.Homeworks {
		if homework.ID == homeworkID {
			return homework, nil
		}
	}
	return HomeworkTask{}, errors.New("homework not found")
}

func (s *Service) requireLessonAccess(ctx context.Context, lessonID string) (Lesson, error) {
	lessonID = strings.TrimSpace(lessonID)
	if lessonID == "" {
		return Lesson{}, errors.New("lesson_id is required")
	}
	dashboard, err := s.DashboardFor(ctx)
	if err != nil {
		return Lesson{}, err
	}
	for _, lesson := range dashboard.Lessons {
		if lesson.ID == lessonID {
			return lesson, nil
		}
	}
	return Lesson{}, errors.New("lesson not found")
}
