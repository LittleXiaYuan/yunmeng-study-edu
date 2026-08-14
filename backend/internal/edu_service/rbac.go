package edu_service

func hasClass(classIDs []string, classID string) bool {
	if len(classIDs) == 0 {
		return false
	}
	for _, id := range classIDs {
		if id == classID {
			return true
		}
	}
	return false
}

func filterClasses(items []Class, classIDs []string) []Class {
	out := []Class{}
	for _, item := range items {
		if hasClass(classIDs, item.ID) {
			out = append(out, item)
		}
	}
	return out
}

// filterSchoolsByClasses 只保留可见班级所属的学校（teacher/student 视角）。
func filterSchoolsByClasses(items []School, classes []Class) []School {
	allowed := map[string]bool{}
	for _, class := range classes {
		if class.SchoolID != "" {
			allowed[class.SchoolID] = true
		}
	}
	out := []School{}
	for _, item := range items {
		if allowed[item.ID] {
			out = append(out, item)
		}
	}
	return out
}

func filterStudentsByClasses(items []Student, classIDs []string) []Student {
	out := []Student{}
	for _, item := range items {
		if hasClass(classIDs, item.ClassID) {
			out = append(out, item)
		}
	}
	return out
}

func filterStudentsByID(items []Student, studentID string) []Student {
	out := []Student{}
	for _, item := range items {
		if item.ID == studentID {
			out = append(out, item)
		}
	}
	return out
}

func filterCoursesByClasses(items []Course, classIDs []string) []Course {
	out := []Course{}
	for _, item := range items {
		if hasClass(classIDs, item.ClassID) {
			out = append(out, item)
		}
	}
	return out
}

func filterLessonsByCourses(items []Lesson, courses []Course) []Lesson {
	allowed := map[string]bool{}
	for _, course := range courses {
		allowed[course.ID] = true
	}
	out := []Lesson{}
	for _, item := range items {
		if allowed[item.CourseID] {
			out = append(out, item)
		}
	}
	return out
}

func filterSessionsByClasses(items []LearningSession, classIDs []string) []LearningSession {
	out := []LearningSession{}
	for _, item := range items {
		if hasClass(classIDs, item.ClassID) {
			out = append(out, item)
		}
	}
	return out
}

func filterHomeworksByClasses(items []HomeworkTask, classIDs []string) []HomeworkTask {
	out := []HomeworkTask{}
	for _, item := range items {
		if hasClass(classIDs, item.ClassID) {
			out = append(out, item)
		}
	}
	return out
}

func filterHomeworkAttemptsByStudent(items []HomeworkAttempt, studentID string) []HomeworkAttempt {
	out := []HomeworkAttempt{}
	for _, item := range items {
		if item.StudentID == studentID {
			out = append(out, item)
		}
	}
	return out
}

func filterHomeworkAttemptsByHomeworks(items []HomeworkAttempt, homeworks []HomeworkTask) []HomeworkAttempt {
	allowed := map[string]bool{}
	for _, homework := range homeworks {
		allowed[homework.ID] = true
	}
	out := []HomeworkAttempt{}
	for _, item := range items {
		if allowed[item.HomeworkID] {
			out = append(out, item)
		}
	}
	return out
}

func filterSessionsByStudent(items []LearningSession, studentID string) []LearningSession {
	out := []LearningSession{}
	for _, item := range items {
		if item.StudentID == studentID {
			out = append(out, item)
		}
	}
	return out
}

func recalcDashboard(d Dashboard) Dashboard {
	totalTrust := 0
	totalUnderstand := 0
	problems := []string{}
	for _, session := range d.Sessions {
		totalTrust += session.TrustScore
		totalUnderstand += session.Evaluation.UnderstandingScore
		problems = mergeStrings(problems, session.Evaluation.ErrorTypes)
	}
	d.AverageTrust = 0
	d.AverageUnderstand = 0
	if len(d.Sessions) > 0 {
		d.AverageTrust = totalTrust / len(d.Sessions)
		d.AverageUnderstand = totalUnderstand / len(d.Sessions)
	}
	if len(problems) == 0 {
		problems = []string{"暂无明显共性问题"}
	}
	d.CommonProblems = problems
	indexed := 0
	for _, lesson := range d.Lessons {
		if !lesson.Archived {
			indexed++
		}
	}
	d.RetrievalIndex.IndexedCount = indexed
	return d
}
