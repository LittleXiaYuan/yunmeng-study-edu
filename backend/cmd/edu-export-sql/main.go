package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type platformState struct {
	Classes      []map[string]any `json:"classes"`
	Students     []map[string]any `json:"students"`
	Courses      []map[string]any `json:"courses"`
	Lessons      []map[string]any `json:"lessons"`
	Homeworks    []map[string]any `json:"homeworks"`
	Attempts     []map[string]any `json:"homework_attempts"`
	Sessions     []map[string]any `json:"sessions"`
	Audit        []map[string]any `json:"audit"`
	Users        []map[string]any `json:"users"`
	AuthSessions []map[string]any `json:"auth_sessions"`
	LLMConfig    map[string]any   `json:"llm_config"`
}

func main() {
	dataDir := flag.String("data", "data", "backend data directory")
	outPath := flag.String("out", "", "output SQL path, defaults stdout")
	orgID := flag.String("org", "org_default", "organization id")
	orgName := flag.String("org-name", "默认学校", "organization name")
	flag.Parse()

	statePath := filepath.Join(*dataDir, "platform_state.json")
	data, err := os.ReadFile(statePath)
	must(err)
	var st platformState
	must(json.Unmarshal(data, &st))

	var b strings.Builder
	b.WriteString("BEGIN;\n")
	b.WriteString("INSERT INTO organizations(id,name,plan,active) VALUES (")
	b.WriteString(sql(*orgID) + "," + sql(*orgName) + ",'trial',TRUE) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, updated_at=now();\n")

	for _, row := range st.Classes {
		insertClass(&b, *orgID, row)
	}
	for _, row := range st.Students {
		insertStudent(&b, *orgID, row)
	}
	for _, row := range st.Courses {
		insertCourse(&b, *orgID, row)
	}
	for _, row := range st.Lessons {
		insertLesson(&b, *orgID, row)
	}
	for _, row := range st.Homeworks {
		insertHomework(&b, *orgID, row)
	}
	for _, row := range st.Users {
		insertUser(&b, *orgID, row)
	}
	for _, row := range st.Attempts {
		insertAttempt(&b, *orgID, row)
	}
	for _, row := range st.Sessions {
		insertSession(&b, *orgID, row)
	}
	for _, row := range st.Audit {
		insertAudit(&b, *orgID, row)
	}
	for _, row := range st.AuthSessions {
		insertAuthSession(&b, *orgID, row)
	}
	if len(st.LLMConfig) > 0 {
		insertLLM(&b, *orgID, st.LLMConfig)
	}
	b.WriteString("COMMIT;\n")

	if *outPath == "" {
		fmt.Print(b.String())
		return
	}
	must(os.WriteFile(*outPath, []byte(b.String()), 0644))
}

func insertClass(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO classes(id,org_id,name,grade,teacher_id,archived,created_at,updated_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "name")), sql(s(r, "grade")), sql(s(r, "teacher_id")), boolSQL(r, "archived"), timeSQL(r, "created_at"), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, grade=EXCLUDED.grade, teacher_id=EXCLUDED.teacher_id, archived=EXCLUDED.archived, updated_at=EXCLUDED.updated_at;\n")
}

func insertStudent(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO students(id,org_id,name,class_id,user_id,archived,created_at,updated_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "name")), sql(s(r, "class_id")), nullSQL(s(r, "user_id")), boolSQL(r, "archived"), timeSQL(r, "created_at"), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, class_id=EXCLUDED.class_id, user_id=EXCLUDED.user_id, archived=EXCLUDED.archived, updated_at=EXCLUDED.updated_at;\n")
}

func insertCourse(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO courses(id,org_id,name,class_id,archived,created_at,updated_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "name")), sql(s(r, "class_id")), boolSQL(r, "archived"), timeSQL(r, "created_at"), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, class_id=EXCLUDED.class_id, archived=EXCLUDED.archived, updated_at=EXCLUDED.updated_at;\n")
}

func insertLesson(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO lessons(id,org_id,course_id,title,content,file_name,analysis,analysis_done,archived,created_at,updated_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "course_id")), sql(s(r, "title")), sql(s(r, "content")), sql(s(r, "file_name")), jsonb(r["analysis"]), boolSQL(r, "analysis_done"), boolSQL(r, "archived"), timeSQL(r, "created_at"), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, file_name=EXCLUDED.file_name, analysis=EXCLUDED.analysis, analysis_done=EXCLUDED.analysis_done, archived=EXCLUDED.archived, updated_at=EXCLUDED.updated_at;\n")
}

func insertHomework(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO homeworks(id,org_id,course_id,class_id,lesson_id,title,prompt,steps,published,archived,created_by,created_at,updated_at,published_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "course_id")), sql(s(r, "class_id")), nullSQL(s(r, "lesson_id")), sql(s(r, "title")), sql(s(r, "prompt")), jsonb(r["steps"]), boolSQL(r, "published"), boolSQL(r, "archived"), sql(s(r, "created_by")), timeSQL(r, "created_at"), timeSQL(r, "updated_at"), nullableTimeSQL(r, "published_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, prompt=EXCLUDED.prompt, steps=EXCLUDED.steps, published=EXCLUDED.published, archived=EXCLUDED.archived, updated_at=EXCLUDED.updated_at, published_at=EXCLUDED.published_at;\n")
}

func insertUser(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO users(id,org_id,username,name,role,class_ids,student_id,active,password_hash,created_at,updated_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "username")), sql(s(r, "name")), sql(s(r, "role")), textArray(r["class_ids"]), nullSQL(s(r, "student_id")), boolDefaultSQL(r, "active", true), sql(s(r, "password_hash")), timeSQL(r, "created_at"), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, name=EXCLUDED.name, role=EXCLUDED.role, class_ids=EXCLUDED.class_ids, student_id=EXCLUDED.student_id, active=EXCLUDED.active, password_hash=EXCLUDED.password_hash, updated_at=EXCLUDED.updated_at;\n")
}

func insertAttempt(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO homework_attempts(id,org_id,homework_id,student_id,step_index,answer,guidance,evaluation,trust_score,unlocked_permission,completed_step,completed_homework,next_required_action,created_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "homework_id")), sql(s(r, "student_id")), intSQL(r, "step_index"), sql(s(r, "answer")), sql(s(r, "guidance")), jsonb(r["evaluation"]), intSQL(r, "trust_score"), sql(s(r, "unlocked_permission")), boolSQL(r, "completed_step"), boolSQL(r, "completed_homework"), sql(s(r, "next_required_action")), timeSQL(r, "created_at")))
	b.WriteString(") ON CONFLICT (id) DO NOTHING;\n")
}

func insertSession(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO learning_sessions(id,org_id,student_id,course_id,class_id,lesson_id,input,answer,knowledge,evaluation,trust_score,created_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "student_id")), sql(s(r, "course_id")), sql(s(r, "class_id")), sql(s(r, "lesson_id")), sql(s(r, "input")), sql(s(r, "answer")), jsonb(r["knowledge"]), jsonb(r["evaluation"]), intSQL(r, "trust_score"), timeSQL(r, "created_at")))
	b.WriteString(") ON CONFLICT (id) DO NOTHING;\n")
}

func insertAudit(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO audit_logs(id,org_id,actor_id,action,target,detail,created_at) VALUES (")
	b.WriteString(join(sql(s(r, "id")), sql(org), sql(s(r, "actor_id")), sql(s(r, "action")), sql(s(r, "target")), sql(s(r, "detail")), timeSQL(r, "created_at")))
	b.WriteString(") ON CONFLICT (id) DO NOTHING;\n")
}

func insertAuthSession(b *strings.Builder, org string, r map[string]any) {
	if s(r, "token") == "" {
		return
	}
	b.WriteString("INSERT INTO auth_sessions(token,org_id,user_id,expires_at,created_at) VALUES (")
	b.WriteString(join(sql(s(r, "token")), sql(org), sql(s(r, "user_id")), timeSQL(r, "expires_at"), timeSQL(r, "created_at")))
	b.WriteString(") ON CONFLICT (token) DO NOTHING;\n")
}

func insertLLM(b *strings.Builder, org string, r map[string]any) {
	b.WriteString("INSERT INTO llm_configs(org_id,base_url,api_key,model,enabled,updated_at) VALUES (")
	b.WriteString(join(sql(org), sql(s(r, "base_url")), sql(s(r, "api_key")), sql(s(r, "model")), boolDefaultSQL(r, "enabled", true), timeSQL(r, "updated_at")))
	b.WriteString(") ON CONFLICT (org_id) DO UPDATE SET base_url=EXCLUDED.base_url, api_key=EXCLUDED.api_key, model=EXCLUDED.model, enabled=EXCLUDED.enabled, updated_at=EXCLUDED.updated_at;\n")
}

func s(r map[string]any, key string) string {
	if v, ok := r[key].(string); ok {
		return v
	}
	return ""
}
func sql(v string) string { return "'" + strings.ReplaceAll(v, "'", "''") + "'" }
func nullSQL(v string) string {
	if v == "" {
		return "NULL"
	}
	return sql(v)
}
func join(items ...string) string                 { return strings.Join(items, ",") }
func boolSQL(r map[string]any, key string) string { return boolDefaultSQL(r, key, false) }
func boolDefaultSQL(r map[string]any, key string, fallback bool) string {
	v, ok := r[key].(bool)
	if !ok {
		v = fallback
	}
	if v {
		return "TRUE"
	}
	return "FALSE"
}
func intSQL(r map[string]any, key string) string {
	if v, ok := r[key].(float64); ok {
		return fmt.Sprintf("%d", int(v))
	}
	return "0"
}
func timeSQL(r map[string]any, key string) string {
	v := s(r, key)
	if v == "" {
		return "now()"
	}
	return sql(v)
}
func nullableTimeSQL(r map[string]any, key string) string {
	v := s(r, key)
	if v == "" {
		return "NULL"
	}
	return sql(v)
}
func jsonb(v any) string { data, _ := json.Marshal(v); return sql(string(data)) + "::jsonb" }
func textArray(v any) string {
	arr, _ := v.([]any)
	parts := make([]string, 0, len(arr))
	for _, item := range arr {
		parts = append(parts, sql(fmt.Sprint(item)))
	}
	return "ARRAY[" + strings.Join(parts, ",") + "]::text[]"
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
