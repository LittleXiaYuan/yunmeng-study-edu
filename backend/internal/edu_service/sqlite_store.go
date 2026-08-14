package edu_service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

type SQLitePlatformStore struct {
	db       *sql.DB
	mu       sync.Mutex
	ftsReady bool
}

const currentEduSchemaVersion = 2

func NewSQLitePlatformStore(path string, seedDir string) (*SQLitePlatformStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, err
	}
	dsn := path + "?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_foreign_keys=ON"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	store := &SQLitePlatformStore{db: db}
	if err := store.init(); err != nil {
		db.Close()
		return nil, err
	}
	state, err := store.loadState()
	if err != nil {
		db.Close()
		return nil, err
	}
	if state == nil {
		seed := seedState()
		jsonPath := filepath.Join(seedDir, "platform_state.json")
		if data, err := os.ReadFile(jsonPath); err == nil {
			_ = json.Unmarshal(data, &seed)
			seed = ensureStateDefaults(seed)
		}
		if err := store.saveState(seed); err != nil {
			db.Close()
			return nil, err
		}
	} else {
		if err := store.syncRelationalState(*state); err != nil {
			db.Close()
			return nil, err
		}
		if err := store.reindexLessons(*state); err != nil {
			db.Close()
			return nil, err
		}
	}
	return store, nil
}

func (s *SQLitePlatformStore) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *SQLitePlatformStore) State() (PlatformState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadState()
	if err != nil {
		return PlatformState{}, err
	}
	if state == nil {
		return seedState(), nil
	}
	return *state, nil
}

func (s *SQLitePlatformStore) init() error {
	_, err := s.db.Exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA cache_size=-8000;
CREATE TABLE IF NOT EXISTS platform_state (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`)
	if err != nil {
		return err
	}
	if err := s.migrateRelationalSchema(); err != nil {
		return err
	}
	if _, err := s.db.Exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS lesson_search USING fts5(
  lesson_id UNINDEXED,
  course_id UNINDEXED,
  title,
  content,
  concepts
);
`); err != nil {
		s.ftsReady = false
		return nil
	}
	s.ftsReady = true
	return nil
}

func (s *SQLitePlatformStore) migrateRelationalSchema() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			version INTEGER NOT NULL,
			applied_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_classes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			grade TEXT NOT NULL DEFAULT '',
			teacher_id TEXT NOT NULL DEFAULT '',
			archived INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			student_id TEXT NOT NULL DEFAULT '',
			active INTEGER NOT NULL DEFAULT 1,
			password_hash TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_user_classes (
			user_id TEXT NOT NULL REFERENCES edu_users(id) ON DELETE CASCADE,
			class_id TEXT NOT NULL REFERENCES edu_classes(id) ON DELETE CASCADE,
			PRIMARY KEY(user_id, class_id)
		)`,
		`CREATE TABLE IF NOT EXISTS edu_students (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			class_id TEXT NOT NULL REFERENCES edu_classes(id),
			user_id TEXT NOT NULL DEFAULT '',
			archived INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_courses (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			class_id TEXT NOT NULL REFERENCES edu_classes(id),
			archived INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_lessons (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES edu_courses(id),
			title TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			file_name TEXT NOT NULL DEFAULT '',
			analysis_json TEXT NOT NULL DEFAULT '{}',
			analysis_done INTEGER NOT NULL DEFAULT 0,
			archived INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_homeworks (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES edu_courses(id),
			class_id TEXT NOT NULL REFERENCES edu_classes(id),
			lesson_id TEXT REFERENCES edu_lessons(id),
			title TEXT NOT NULL,
			prompt TEXT NOT NULL DEFAULT '',
			steps_json TEXT NOT NULL DEFAULT '[]',
			published INTEGER NOT NULL DEFAULT 0,
			archived INTEGER NOT NULL DEFAULT 0,
			created_by TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			published_at TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS edu_homework_attempts (
			id TEXT PRIMARY KEY,
			homework_id TEXT NOT NULL REFERENCES edu_homeworks(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES edu_students(id),
			step_index INTEGER NOT NULL DEFAULT 0,
			answer TEXT NOT NULL DEFAULT '',
			guidance TEXT NOT NULL DEFAULT '',
			evaluation_json TEXT NOT NULL DEFAULT '{}',
			trust_score INTEGER NOT NULL DEFAULT 0,
			unlocked_permission TEXT NOT NULL DEFAULT '',
			completed_step INTEGER NOT NULL DEFAULT 0,
			completed_homework INTEGER NOT NULL DEFAULT 0,
			next_required_action TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_sessions (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL REFERENCES edu_students(id),
			course_id TEXT NOT NULL REFERENCES edu_courses(id),
			class_id TEXT NOT NULL REFERENCES edu_classes(id),
			lesson_id TEXT REFERENCES edu_lessons(id),
			input TEXT NOT NULL DEFAULT '',
			answer TEXT NOT NULL DEFAULT '',
			knowledge_json TEXT NOT NULL DEFAULT '{}',
			evaluation_json TEXT NOT NULL DEFAULT '{}',
			trust_score INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS edu_audit_logs (
			id TEXT PRIMARY KEY,
			actor_id TEXT NOT NULL DEFAULT '',
			action TEXT NOT NULL,
			target TEXT NOT NULL DEFAULT '',
			detail TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_courses_class ON edu_courses(class_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_students_class ON edu_students(class_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_lessons_course ON edu_lessons(course_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_homeworks_class_course ON edu_homeworks(class_id, course_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_attempts_homework_student ON edu_homework_attempts(homework_id, student_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_sessions_class_student ON edu_sessions(class_id, student_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_audit_created ON edu_audit_logs(created_at)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("sqlite schema: %w", err)
		}
	}
	_, err := s.db.Exec(`INSERT INTO schema_migrations(id, version, applied_at)
VALUES('study_edu_sqlite', ?, ?)
ON CONFLICT(id) DO UPDATE SET version = excluded.version, applied_at = excluded.applied_at`, currentEduSchemaVersion, nowString())
	return err
}

func (s *SQLitePlatformStore) loadState() (*PlatformState, error) {
	var raw string
	err := s.db.QueryRow(`SELECT data FROM platform_state WHERE id = 'default'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var state PlatformState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return nil, err
	}
	state = ensureStateDefaults(state)
	return &state, nil
}

func (s *SQLitePlatformStore) saveState(state PlatformState) error {
	state = ensureStateDefaults(state)
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO platform_state(id, data, updated_at) VALUES('default', ?, ?)
ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`, string(data), nowString())
	if err != nil {
		return err
	}
	if err := s.syncRelationalState(state); err != nil {
		return err
	}
	return s.reindexLessons(state)
}

func (s *SQLitePlatformStore) syncRelationalState(state PlatformState) error {
	state = ensureStateDefaults(state)
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	for _, table := range []string{
		"edu_homework_attempts",
		"edu_sessions",
		"edu_homeworks",
		"edu_lessons",
		"edu_user_classes",
		"edu_students",
		"edu_courses",
		"edu_users",
		"edu_classes",
		"edu_audit_logs",
	} {
		if _, err = tx.Exec(`DELETE FROM ` + table); err != nil {
			return err
		}
	}
	for _, item := range state.Classes {
		if _, err = tx.Exec(`INSERT INTO edu_classes(id, name, grade, teacher_id, archived, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?)`, item.ID, item.Name, item.Grade, item.TeacherID, boolInt(item.Archived), item.CreatedAt, item.UpdatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Users {
		if _, err = tx.Exec(`INSERT INTO edu_users(id, username, name, role, student_id, active, password_hash, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.ID, item.Username, item.Name, item.Role, item.StudentID, boolInt(item.Active), item.PasswordHash, item.CreatedAt, item.UpdatedAt); err != nil {
			return err
		}
		for _, classID := range item.ClassIDs {
			if _, err = tx.Exec(`INSERT OR IGNORE INTO edu_user_classes(user_id, class_id) VALUES(?, ?)`, item.ID, classID); err != nil {
				return err
			}
		}
	}
	for _, item := range state.Students {
		if _, err = tx.Exec(`INSERT INTO edu_students(id, name, class_id, user_id, archived, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?)`, item.ID, item.Name, item.ClassID, item.UserID, boolInt(item.Archived), item.CreatedAt, item.UpdatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Courses {
		if _, err = tx.Exec(`INSERT INTO edu_courses(id, name, class_id, archived, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?)`, item.ID, item.Name, item.ClassID, boolInt(item.Archived), item.CreatedAt, item.UpdatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Lessons {
		if _, err = tx.Exec(`INSERT INTO edu_lessons(id, course_id, title, content, file_name, analysis_json, analysis_done, archived, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.ID, item.CourseID, item.Title, item.Content, item.FileName, jsonText(item.Analysis, "{}"), boolInt(item.AnalysisDone), boolInt(item.Archived), item.CreatedAt, item.UpdatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Homeworks {
		if _, err = tx.Exec(`INSERT INTO edu_homeworks(id, course_id, class_id, lesson_id, title, prompt, steps_json, published, archived, created_by, created_at, updated_at, published_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.ID, item.CourseID, item.ClassID, nullableText(item.LessonID), item.Title, item.Prompt, jsonText(item.Steps, "[]"), boolInt(item.Published), boolInt(item.Archived), item.CreatedBy, item.CreatedAt, item.UpdatedAt, item.PublishedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Attempts {
		if _, err = tx.Exec(`INSERT INTO edu_homework_attempts(id, homework_id, student_id, step_index, answer, guidance, evaluation_json, trust_score, unlocked_permission, completed_step, completed_homework, next_required_action, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.ID, item.HomeworkID, item.StudentID, item.StepIndex, item.Answer, item.Guidance, jsonText(item.Evaluation, "{}"), item.TrustScore, item.UnlockedPermission, boolInt(item.CompletedStep), boolInt(item.CompletedHomework), item.NextRequiredAction, item.CreatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Sessions {
		if _, err = tx.Exec(`INSERT INTO edu_sessions(id, student_id, course_id, class_id, lesson_id, input, answer, knowledge_json, evaluation_json, trust_score, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.ID, item.StudentID, item.CourseID, item.ClassID, nullableText(item.LessonID), item.Input, item.Answer, jsonText(item.Knowledge, "{}"), jsonText(item.Evaluation, "{}"), item.TrustScore, item.CreatedAt); err != nil {
			return err
		}
	}
	for _, item := range state.Audit {
		if _, err = tx.Exec(`INSERT INTO edu_audit_logs(id, actor_id, action, target, detail, created_at)
VALUES(?, ?, ?, ?, ?, ?)`, item.ID, item.ActorID, item.Action, item.Target, item.Detail, item.CreatedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *SQLitePlatformStore) Login(username string, password string) (LoginResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return LoginResponse{}, err
	}
	return loginInState(state, username, password, s.saveState)
}

func (s *SQLitePlatformStore) UserByToken(token string) (User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return User{}, false
	}
	return userByTokenInState(state, token)
}

func (s *SQLitePlatformStore) ListUsers() ([]User, error) {
	state, err := s.State()
	if err != nil {
		return nil, err
	}
	return state.Users, nil
}
func (s *SQLitePlatformStore) LLMConfig() (LLMConfig, error) {
	state, err := s.State()
	if err != nil {
		return LLMConfig{}, err
	}
	return state.LLMConfig, nil
}

func (s *SQLitePlatformStore) UpdateLLMConfig(config LLMConfig, actorID string) (LLMConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return LLMConfig{}, err
	}
	return updateLLMConfigInState(state, config, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertUser(req CreateUserRequest, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return User{}, err
	}
	return upsertUserInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpdateUser(req UpdateUserRequest, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return User{}, err
	}
	return updateUserInState(state, req, actorID, s.saveState)
}

func (s *SQLitePlatformStore) UpdateUserImage(userID string, kind string, url string, actorID string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return User{}, err
	}
	return updateUserImageInState(state, userID, kind, url, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertClass(req CreateClassRequest, actorID string) (Class, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Class{}, err
	}
	return upsertClassInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertSchool(req CreateSchoolRequest, actorID string) (School, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return School{}, err
	}
	return upsertSchoolInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) AppendAudit(actorID string, action string, target string, detail string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return err
	}
	return appendAuditInState(state, actorID, action, target, detail, s.saveState)
}
func (s *SQLitePlatformStore) UpsertStudent(req CreateStudentRequest, actorID string) (Student, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Student{}, err
	}
	return upsertStudentInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertCourse(req CreateCourseRequest, actorID string) (Course, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Course{}, err
	}
	return upsertCourseInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertLesson(req CreateLessonRequest, analysis KnowledgeAnalysis, fileName string, actorID string) (Lesson, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Lesson{}, err
	}
	return upsertLessonInState(state, req, analysis, fileName, actorID, s.saveState)
}
func (s *SQLitePlatformStore) UpsertHomework(req CreateHomeworkRequest, actorID string) (HomeworkTask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return HomeworkTask{}, err
	}
	return upsertHomeworkInState(state, req, actorID, s.saveState)
}
func (s *SQLitePlatformStore) AddHomeworkAttempt(attempt HomeworkAttempt) (HomeworkAttempt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return HomeworkAttempt{}, err
	}
	return addHomeworkAttemptInState(state, attempt, s.saveState)
}

func (s *SQLitePlatformStore) ResetHomeworkAttempts(homeworkID string, studentID string, actorID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return 0, err
	}
	return resetHomeworkAttemptsInState(state, homeworkID, studentID, actorID, s.saveState)
}

func (s *SQLitePlatformStore) AddSession(session LearningSession) (LearningSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return LearningSession{}, err
	}
	return addSessionInState(state, session, s.saveState)
}

func (s *SQLitePlatformStore) ListConversations(ownerID string) ([]Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return nil, err
	}
	return listConversationsForOwner(state, ownerID), nil
}

func (s *SQLitePlatformStore) ConversationByID(id string, ownerID string) (Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Conversation{}, err
	}
	return conversationForOwner(state, id, ownerID)
}

func (s *SQLitePlatformStore) UpsertConversation(req SaveConversationRequest, ownerID string) (Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return Conversation{}, err
	}
	return upsertConversationInState(state, req, ownerID, s.saveState)
}

func (s *SQLitePlatformStore) DeleteConversation(id string, ownerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return err
	}
	return deleteConversationInState(state, id, ownerID, s.saveState)
}

func (s *SQLitePlatformStore) loadStateValue() (PlatformState, error) {
	state, err := s.loadState()
	if err != nil {
		return PlatformState{}, err
	}
	if state == nil {
		seeded := seedState()
		return seeded, nil
	}
	return *state, nil
}

func (s *SQLitePlatformStore) SearchLessons(query string, courseID string, limit int) ([]RetrievalHit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.loadStateValue()
	if err != nil {
		return nil, err
	}
	query = strings.TrimSpace(query)
	if limit < 1 {
		limit = 4
	}
	if query == "" {
		return searchLessonsInState(state, query, courseID, limit), nil
	}
	if hits, err := s.searchLessonsFTS(state, query, courseID, limit); err == nil && len(hits) > 0 {
		return hits, nil
	}
	return searchLessonsInState(state, query, courseID, limit), nil
}

func (s *SQLitePlatformStore) RetrievalStats() (RetrievalIndexStats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.ftsReady {
		state, err := s.loadStateValue()
		if err != nil {
			return RetrievalIndexStats{}, err
		}
		count := 0
		for _, lesson := range state.Lessons {
			if !lesson.Archived {
				count++
			}
		}
		return RetrievalIndexStats{Status: "keyword-fallback", IndexedCount: count}, nil
	}
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM lesson_search`).Scan(&count); err != nil {
		state, stateErr := s.loadStateValue()
		if stateErr != nil {
			return RetrievalIndexStats{}, err
		}
		return RetrievalIndexStats{Status: "keyword-fallback", IndexedCount: len(state.Lessons)}, nil
	}
	return RetrievalIndexStats{Status: "sqlite-fts5", IndexedCount: count}, nil
}

func (s *SQLitePlatformStore) reindexLessons(state PlatformState) error {
	if !s.ftsReady {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM lesson_search`); err != nil {
		_ = tx.Rollback()
		return err
	}
	stmt, err := tx.Prepare(`INSERT INTO lesson_search(lesson_id, course_id, title, content, concepts) VALUES(?, ?, ?, ?, ?)`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, lesson := range state.Lessons {
		if lesson.Archived {
			continue
		}
		if _, err := stmt.Exec(lesson.ID, lesson.CourseID, lesson.Title, lesson.Content, strings.Join(lesson.Analysis.Concepts, " ")); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (s *SQLitePlatformStore) searchLessonsFTS(state PlatformState, query string, courseID string, limit int) ([]RetrievalHit, error) {
	if !s.ftsReady {
		return nil, errors.New("fts index is not available")
	}
	match := ftsQuery(query)
	if match == "" {
		return searchLessonsInState(state, query, courseID, limit), nil
	}
	sqlQuery := `SELECT lesson_id, bm25(lesson_search) AS rank FROM lesson_search WHERE lesson_search MATCH ?`
	args := []any{match}
	if strings.TrimSpace(courseID) != "" {
		sqlQuery += ` AND course_id = ?`
		args = append(args, strings.TrimSpace(courseID))
	}
	sqlQuery += ` ORDER BY rank LIMIT ?`
	args = append(args, limit)
	rows, err := s.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lessons := map[string]Lesson{}
	for _, lesson := range state.Lessons {
		lessons[lesson.ID] = lesson
	}
	hits := []RetrievalHit{}
	for rows.Next() {
		var lessonID string
		var rank float64
		if err := rows.Scan(&lessonID, &rank); err != nil {
			return nil, err
		}
		lesson, ok := lessons[lessonID]
		if !ok || lesson.Archived {
			continue
		}
		score := 100 - int(rank*10)
		if score < 1 {
			score = retrievalScore(lesson, query, retrievalTerms(query))
		}
		hits = append(hits, lessonRetrievalHit(lesson, query, retrievalTerms(query), score))
	}
	return hits, rows.Err()
}

func ftsQuery(query string) string {
	// 与内存检索共用 tokenizeQuery（中文 bigram + 英文词）
	terms := retrievalTerms(query)
	clean := []string{}
	seen := map[string]bool{}
	for _, term := range terms {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		term = strings.NewReplacer(`"`, " ", "'", " ", "*", " ", ":", " ").Replace(term)
		term = strings.TrimSpace(term)
		if term == "" || seen[term] {
			continue
		}
		seen[term] = true
		clean = append(clean, `"`+term+`"`)
	}
	return strings.Join(clean, " OR ")
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func nullableText(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func jsonText(value any, fallback string) string {
	data, err := json.Marshal(value)
	if err != nil || len(data) == 0 {
		return fallback
	}
	return string(data)
}
