package edu_service

import (
	"path/filepath"
	"testing"
)

func TestSQLiteStoreProjectsStateIntoRelationalTables(t *testing.T) {
	dir := t.TempDir()
	store, err := NewSQLitePlatformStore(filepath.Join(dir, "edu.db"), dir)
	if err != nil {
		t.Fatalf("open sqlite store: %v", err)
	}
	defer store.Close()

	var foreignKeys int
	if err := store.db.QueryRow(`PRAGMA foreign_keys`).Scan(&foreignKeys); err != nil {
		t.Fatalf("read foreign_keys pragma: %v", err)
	}
	if foreignKeys != 1 {
		t.Fatalf("foreign key enforcement is disabled")
	}

	var version int
	if err := store.db.QueryRow(`SELECT version FROM schema_migrations WHERE id = 'study_edu_sqlite'`).Scan(&version); err != nil {
		t.Fatalf("read schema migration: %v", err)
	}
	if version != currentEduSchemaVersion {
		t.Fatalf("schema version = %d, want %d", version, currentEduSchemaVersion)
	}

	assertCount(t, store, "edu_classes", 1)
	assertCount(t, store, "edu_courses", 1)
	assertCount(t, store, "edu_lessons", 1)
	assertCount(t, store, "edu_students", 2)

	if _, err := store.UpsertLesson(CreateLessonRequest{
		ID:       "lesson_rel_001",
		CourseID: "course_db",
		Title:    "关系投影测试",
		Content:  "用于验证 SQLite 外键引用和关系投影。",
	}, fallbackKnowledge("关系投影测试"), "test.md", "teacher_001"); err != nil {
		t.Fatalf("upsert lesson: %v", err)
	}

	assertCount(t, store, "edu_lessons", 2)

	var courseID string
	if err := store.db.QueryRow(`SELECT course_id FROM edu_lessons WHERE id = 'lesson_rel_001'`).Scan(&courseID); err != nil {
		t.Fatalf("read projected lesson: %v", err)
	}
	if courseID != "course_db" {
		t.Fatalf("lesson course_id = %q, want course_db", courseID)
	}

	rows, err := store.db.Query(`PRAGMA foreign_key_check`)
	if err != nil {
		t.Fatalf("foreign_key_check: %v", err)
	}
	defer rows.Close()
	if rows.Next() {
		t.Fatal("foreign_key_check returned violations")
	}
}

func TestSQLiteStoreDeclaresTeachingForeignKeys(t *testing.T) {
	dir := t.TempDir()
	store, err := NewSQLitePlatformStore(filepath.Join(dir, "edu.db"), dir)
	if err != nil {
		t.Fatalf("open sqlite store: %v", err)
	}
	defer store.Close()

	if !hasForeignKey(t, store, "edu_courses", "class_id", "edu_classes", "id") {
		t.Fatal("edu_courses.class_id should reference edu_classes.id")
	}
	if !hasForeignKey(t, store, "edu_lessons", "course_id", "edu_courses", "id") {
		t.Fatal("edu_lessons.course_id should reference edu_courses.id")
	}
	if !hasForeignKey(t, store, "edu_homeworks", "lesson_id", "edu_lessons", "id") {
		t.Fatal("edu_homeworks.lesson_id should reference edu_lessons.id")
	}
	if !hasForeignKey(t, store, "edu_homework_attempts", "student_id", "edu_students", "id") {
		t.Fatal("edu_homework_attempts.student_id should reference edu_students.id")
	}
}

func assertCount(t *testing.T, store *SQLitePlatformStore, table string, want int) {
	t.Helper()
	var got int
	if err := store.db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if got != want {
		t.Fatalf("%s count = %d, want %d", table, got, want)
	}
}

func hasForeignKey(t *testing.T, store *SQLitePlatformStore, table, from, refTable, refColumn string) bool {
	t.Helper()
	rows, err := store.db.Query(`PRAGMA foreign_key_list(` + table + `)`)
	if err != nil {
		t.Fatalf("foreign_key_list %s: %v", table, err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, seq int
		var tableName, fromColumn, toColumn, onUpdate, onDelete, match string
		if err := rows.Scan(&id, &seq, &tableName, &fromColumn, &toColumn, &onUpdate, &onDelete, &match); err != nil {
			t.Fatalf("scan foreign_key_list %s: %v", table, err)
		}
		if tableName == refTable && fromColumn == from && toColumn == refColumn {
			return true
		}
	}
	return false
}
