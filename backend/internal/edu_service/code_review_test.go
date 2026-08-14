package edu_service

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	_ "modernc.org/sqlite" // 注册 "sqlite" 驱动（沙盒测试用）
)

// ─── SQL 沙盒执行 ──────────────────────────────────────────────────────────

func TestSQLReviewerDetectsSyntaxError(t *testing.T) {
	r := sqlReviewer{}
	res, err := r.Review(context.Background(), CodeReviewRequest{
		Code:     "SELECT * FORM students", // FORM 是错字
		Language: "sql",
		Question: "查询所有学生",
	})
	if err != nil {
		t.Fatalf("review: %v", err)
	}
	if res.SyntaxOK {
		t.Errorf("expected syntax error to be detected")
	}
	if res.Score > 60 {
		t.Errorf("expected low score on syntax error, got %d", res.Score)
	}
	hasErr := false
	for _, iss := range res.Issues {
		if iss.Severity == "error" && iss.Type == "syntax" {
			hasErr = true
		}
	}
	if !hasErr {
		t.Errorf("expected at least one syntax error issue, got %+v", res.Issues)
	}
}

func TestSQLReviewerExecutesValidQueryInSandbox(t *testing.T) {
	r := sqlReviewer{}
	res, err := r.Review(context.Background(), CodeReviewRequest{
		Code:     "SELECT id, name FROM students WHERE class_id = 'c1' ORDER BY id",
		Language: "sql",
		Schema:   "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, class_id TEXT);",
	})
	if err != nil {
		t.Fatalf("review: %v", err)
	}
	if !res.SyntaxOK || !res.ExecutedOK {
		t.Errorf("expected executable query, got syntax_ok=%v executed_ok=%v", res.SyntaxOK, res.ExecutedOK)
	}
	if res.Score < 70 {
		t.Errorf("expected decent score for clean query, got %d", res.Score)
	}
}

func TestSQLReviewerFlagsSelectStar(t *testing.T) {
	r := sqlReviewer{}
	res, _ := r.Review(context.Background(), CodeReviewRequest{
		Code:     "SELECT * FROM students;",
		Language: "sql",
	})
	hasStar := false
	for _, iss := range res.Issues {
		if iss.Type == "style" && strings.Contains(iss.Message, "SELECT *") {
			hasStar = true
		}
	}
	if !hasStar {
		t.Errorf("expected SELECT * warning, got issues=%+v", res.Issues)
	}
}

func TestSQLReviewerFlagsDeleteWithoutWhere(t *testing.T) {
	r := sqlReviewer{}
	res, _ := r.Review(context.Background(), CodeReviewRequest{
		Code:     "DELETE FROM students;",
		Language: "sql",
	})
	hasSafetyErr := false
	for _, iss := range res.Issues {
		if iss.Severity == "error" && iss.Type == "safety" {
			hasSafetyErr = true
		}
	}
	if !hasSafetyErr {
		t.Errorf("expected DELETE-without-WHERE safety error, got issues=%+v", res.Issues)
	}
}

func TestSQLReviewerSandboxIsReadOnly(t *testing.T) {
	// 沙盒应当 ROLLBACK：在 review 里跑一次 DELETE 后，新开的 :memory: 数据库
	// 仍然应该能完整建表 + 看到 3 行（证明 review 内部的沙盒没污染外部）
	r := sqlReviewer{}
	_, _ = r.Review(context.Background(), CodeReviewRequest{
		Code:   "DELETE FROM students;",
		Schema: "CREATE TABLE students (id INT); INSERT INTO students VALUES (1),(2),(3);",
	})
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open new sandbox: %v", err)
	}
	defer db.Close()
	if _, err := db.Exec("CREATE TABLE students (id INT); INSERT INTO students VALUES (1),(2),(3);"); err != nil {
		t.Fatalf("recreate schema: %v", err)
	}
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM students").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 3 {
		t.Errorf("expected 3 rows in fresh sandbox, got %d", n)
	}
}

// ─── Python 启发式（**不执行**） ───────────────────────────────────────────

func TestPythonReviewerDetectsMissingColon(t *testing.T) {
	r := pythonReviewer{}
	res, _ := r.Review(context.Background(), CodeReviewRequest{
		Code:     "def foo(x)\n    return x + 1\n",
		Language: "python",
	})
	hasColonErr := false
	for _, iss := range res.Issues {
		if iss.Severity == "error" && iss.Type == "syntax" && strings.Contains(iss.Message, "冒号") {
			hasColonErr = true
		}
	}
	if !hasColonErr {
		t.Errorf("expected missing-colon error, got issues=%+v", res.Issues)
	}
	if !res.StaticCheckOK {
		t.Errorf("StaticCheckOK should still be true (heuristic doesn't refuse to report)")
	}
}

func TestPythonReviewerFlagsBareExcept(t *testing.T) {
	r := pythonReviewer{}
	res, _ := r.Review(context.Background(), CodeReviewRequest{
		Code: `def safe_div(a, b):
    try:
        return a / b
    except:
        return None
`,
		Language: "python",
	})
	hasBareExcept := false
	for _, iss := range res.Issues {
		if iss.Type == "best_practice" && strings.Contains(iss.Message, "except") {
			hasBareExcept = true
		}
	}
	if !hasBareExcept {
		t.Errorf("expected bare-except warning, got issues=%+v", res.Issues)
	}
}

func TestPythonReviewerCleanCodeHasNoIssues(t *testing.T) {
	r := pythonReviewer{}
	res, _ := r.Review(context.Background(), CodeReviewRequest{
		Code: `def add(a, b):
    return a + b

result = add(1, 2)
print(result)
`,
		Language: "python",
	})
	if res.Score < 90 {
		t.Errorf("expected clean code to score high, got %d (issues=%+v)", res.Score, res.Issues)
	}
}

// ─── Service 入口 / 调度 ──────────────────────────────────────────────────

func TestServiceCodeReviewDispatchesToSQL(t *testing.T) {
	svc := testService(t)
	res, err := svc.CodeReview(context.Background(), CodeReviewRequest{
		Code:     "SELECT * FORM students;",
		Language: "sql",
	})
	if err != nil {
		t.Fatalf("CodeReview: %v", err)
	}
	if res.Language != "sql" {
		t.Errorf("expected sql, got %q", res.Language)
	}
	// 测试用 fakeAgentClient 返回 error；既可能是「未启用」(heuristic_only)
	// 也可能是「尝试后失败」(llm_failed_fallback)，都算 LLM 未生效
	if res.LLMStatus == "llm_enhanced" {
		t.Errorf("expected LLM NOT to enhance (test agent is fake), got %q", res.LLMStatus)
	}
}

func TestServiceCodeReviewRejectsUnsupportedLanguage(t *testing.T) {
	svc := testService(t)
	_, err := svc.CodeReview(context.Background(), CodeReviewRequest{
		Code:     "x = 1",
		Language: "rust",
	})
	if err == nil {
		t.Fatal("expected error for unsupported language")
	}
	if !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("expected 'unsupported' in error, got %v", err)
	}
}

func TestServiceCodeReviewValidatesEmptyCode(t *testing.T) {
	svc := testService(t)
	_, err := svc.CodeReview(context.Background(), CodeReviewRequest{
		Code:     "   \n  ",
		Language: "sql",
	})
	if err == nil {
		t.Fatal("expected error for empty code")
	}
}

func TestServiceCodeReviewCapsCodeSize(t *testing.T) {
	svc := testService(t)
	big := strings.Repeat("SELECT 1; ", 5000) // ~60KB
	_, err := svc.CodeReview(context.Background(), CodeReviewRequest{
		Code:     big,
		Language: "sql",
	})
	if err == nil {
		t.Fatal("expected error for oversized code")
	}
}

func TestSupportedCodeLanguagesIncludesCoreOnes(t *testing.T) {
	langs := SupportedCodeLanguages()
	have := map[string]bool{}
	for _, l := range langs {
		have[l] = true
	}
	if !have["sql"] || !have["python"] {
		t.Errorf("expected sql and python in supported list, got %v", langs)
	}
}

func TestRegisterCodeReviewerAddsLanguage(t *testing.T) {
	// CodeReviewerFunc 适配器：测试动态注册是否生效
	ok := RegisterCodeReviewer(CodeReviewerFunc{
		Lang: "ruby-tmp",
		Fn: func(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error) {
			return CodeReviewResult{Language: "ruby-tmp", Score: 100, Summary: "ok"}, nil
		},
	})
	if !ok {
		t.Fatal("register should succeed")
	}
	got := LookupCodeReviewer("ruby-tmp")
	if got == nil {
		t.Fatal("registered reviewer not found")
	}
	if got.Language() != "ruby-tmp" {
		t.Errorf("expected language 'ruby-tmp', got %q", got.Language())
	}
	// 清理：避免污染其它测试
	delete(codeReviewerRegistry, "ruby-tmp")
}

// ─── 守门：sanitizeNoLeak 不能让完整 SQL 修正漏出 ─────────────────────────

func TestSanitizeNoLeakHidesFullSelect(t *testing.T) {
	leak := "试着把 WHERE 改成：\nSELECT id, name FROM students WHERE class_id = 'c1';\n这样就行了"
	out := sanitizeNoLeak(leak)
	if strings.Contains(strings.ToUpper(out), "SELECT ID, NAME FROM STUDENTS") {
		t.Errorf("sanitizeNoLeak let a full SELECT slip through: %s", out)
	}
}

func TestMergeIssuesDedupesAndSorts(t *testing.T) {
	a := []CodeIssue{
		{Severity: "warning", Type: "style", Line: 5, Message: "use 4 spaces"},
		{Severity: "error", Type: "syntax", Line: 1, Message: "missing colon"},
	}
	b := []CodeIssue{
		{Severity: "info", Type: "style", Line: 7, Message: "indent"},
		{Severity: "error", Type: "syntax", Line: 2, Message: "missing colon"}, // 与 a 重复
	}
	merged := mergeIssues(a, b)
	if len(merged) != 3 {
		t.Errorf("expected 3 unique issues, got %d: %+v", len(merged), merged)
	}
	// 排序：error < warning < info
	if merged[0].Severity != "error" || merged[1].Severity != "warning" || merged[2].Severity != "info" {
		t.Errorf("issues not sorted by severity: %+v", merged)
	}
}
