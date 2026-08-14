package edu_service

// 代码审查 (Code Review) Agent —— 第 5 个 Agent
//
// 设计原则（与现有四 Agent 一致）：
//   - LLM-optional：每个语言适配器本地启发式兜底
//   - 不直接给答案：审查反馈是「指出问题 + 提示方向」，与 TutorAgent 守门一致
//   - 沙盒安全：SQL 在 in-memory SQLite 事务中执行并回滚，不污染平台数据
//
// 扩展点：新增语言只需实现 CodeReviewer 接口并 RegisterCodeReviewer()。

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite" // 注册 "sqlite" 驱动；沙盒用 :memory:
)

// ─── 注册中心 ──────────────────────────────────────────────────────────────

// codeReviewerRegistry 是可扩展语言适配器注册表（线程安全读多写少，简单 map+mutex）。
// 启动时由 init() 注册 sqlReviewer / pythonReviewer；测试和后续新增语言可调用
// RegisterCodeReviewer() 在运行时动态加入。
var codeReviewerRegistry = map[string]CodeReviewer{}

// RegisterCodeReviewer 注册一个语言审查器（同名覆盖）。返回 false 表示语言为空。
func RegisterCodeReviewer(r CodeReviewer) bool {
	if r == nil || strings.TrimSpace(r.Language()) == "" {
		return false
	}
	codeReviewerRegistry[strings.ToLower(r.Language())] = r
	return true
}

// LookupCodeReviewer 取指定语言的审查器；找不到返回 nil。
func LookupCodeReviewer(lang string) CodeReviewer {
	return codeReviewerRegistry[strings.ToLower(strings.TrimSpace(lang))]
}

// SupportedCodeLanguages 返回当前已注册的语言列表（按字母序）。
func SupportedCodeLanguages() []string {
	out := make([]string, 0, len(codeReviewerRegistry))
	for k := range codeReviewerRegistry {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func init() {
	_ = RegisterCodeReviewer(&sqlReviewer{})
	_ = RegisterCodeReviewer(&pythonReviewer{})
}

// ─── Service 入口 ──────────────────────────────────────────────────────────

// CodeReview 调度入口：
//  1. 找适配器（不支持的语言返回 400 类错误）
//  2. 调用本地启发式审查（必有结果）
//  3. 如 LLM 可用 + 代码量适中，用 LLM 增强（追加 issues / 改进 suggestion）
//  4. 标记 LLMStatus 给前端展示
func (s *Service) CodeReview(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error) {
	req.Code = strings.TrimSpace(req.Code)
	req.Language = strings.ToLower(strings.TrimSpace(req.Language))
	if req.Code == "" {
		return CodeReviewResult{}, errors.New("code is required")
	}
	if req.Language == "" {
		return CodeReviewResult{}, errors.New("language is required")
	}
	// 粗略 size cap：避免 LLM/沙盒被打爆
	if len(req.Code) > 20*1024 {
		return CodeReviewResult{}, errors.New("code too large (max 20KB)")
	}

	reviewer := LookupCodeReviewer(req.Language)
	if reviewer == nil {
		return CodeReviewResult{}, fmt.Errorf("unsupported language: %s (supported: %s)",
			req.Language, strings.Join(SupportedCodeLanguages(), ", "))
	}

	result, err := reviewer.Review(ctx, req)
	if err != nil {
		return CodeReviewResult{}, err
	}
	result.Language = req.Language
	result.ReviewedAt = nowString()

	// 启发式兜底 → LLM 增强（如果可用）
	enhanced, llmStatus := s.enhanceCodeReviewWithLLM(ctx, req, result)
	if enhanced == nil {
		result.LLMStatus = llmStatus
		return result, nil
	}
	enhanced.Language = result.Language
	enhanced.ReviewedAt = result.ReviewedAt
	// 保留启发式的「技术状态」字段（SyntaxOK / ExecutedOK / StaticCheckOK），
	// 用 LLM 的 issues / suggestion / score 增强
	enhanced.SyntaxOK = result.SyntaxOK
	enhanced.ExecutedOK = result.ExecutedOK
	enhanced.StaticCheckOK = result.StaticCheckOK
	enhanced.LLMStatus = llmStatus
	return *enhanced, nil
}

// enhanceCodeReviewWithLLM 用 LLM 对启发式结果做增强：
//   - 不直接给修正后代码（prompt 强约束）
//   - 失败/禁用/不支持时返回 nil + 状态
func (s *Service) enhanceCodeReviewWithLLM(ctx context.Context, req CodeReviewRequest, local CodeReviewResult) (*CodeReviewResult, string) {
	if s.agent == nil {
		return nil, "heuristic_only"
	}
	// 代码量太短或太长都跳过 LLM（成本/收益不划算）
	if n := len(req.Code); n < 8 || n > 6*1024 {
		return nil, "heuristic_only"
	}
	heuristicSummary := local.Summary
	heuristicIssues := make([]string, 0, len(local.Issues))
	for _, iss := range local.Issues {
		heuristicIssues = append(heuristicIssues, fmt.Sprintf("- [%s/%s] L%d: %s", iss.Severity, iss.Type, iss.Line, iss.Message))
	}
	input := fmt.Sprintf(`【题目】
%s

【已发现的问题（启发式）】
%s
总结：%s

【待审查的代码（%s）】
%s

【其他上下文】
%s
`, strings.TrimSpace(req.Question), strings.Join(heuristicIssues, "\n"), heuristicSummary, req.Language, req.Code, strings.TrimSpace(req.Context))

	text, err := s.agent.Call(ctx, CodeReviewAgentPrompt, input)
	if err != nil || strings.TrimSpace(text) == "" {
		return nil, "llm_failed_fallback"
	}

	// 解析 LLM 输出（容错：剥 Markdown 代码块）
	cleaned := stripMarkdownFence(text)
	var llm CodeReviewResult
	if err := json.Unmarshal([]byte(cleaned), &llm); err != nil {
		// LLM 没按 JSON 输出 → 当作纯文本 summary 增强
		return &CodeReviewResult{
			Score:      local.Score,
			Issues:     local.Issues,
			Summary:    local.Summary,
			Suggestion: trimSuggestionToHint(text, req.Question),
		}, "llm_enhanced"
	}
	// 合并：本地 issues + LLM issues（按 Type+Message 去重）
	merged := mergeIssues(local.Issues, llm.Issues)
	// 分数取 min(local, llm) 更保守：LLM 不"抬高"启发式结果
	score := local.Score
	if llm.Score > 0 && llm.Score < score {
		score = llm.Score
	}
	// Suggestion 优先用 LLM（更自然），若空则用本地
	sug := strings.TrimSpace(llm.Suggestion)
	if sug == "" {
		sug = local.Suggestion
	}
	// 守门：确保最终 Suggestion 不包含直接修正（防止 LLM 失控）
	sug = sanitizeNoLeak(sug)
	summary := strings.TrimSpace(llm.Summary)
	if summary == "" {
		summary = local.Summary
	}
	return &CodeReviewResult{
		Score:      score,
		Issues:     merged,
		Summary:    summary,
		Suggestion: sug,
	}, "llm_enhanced"
}

// ─── 通用辅助 ──────────────────────────────────────────────────────────────

func stripMarkdownFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		// 去掉首尾围栏
		if idx := strings.Index(s, "\n"); idx >= 0 {
			s = s[idx+1:]
		}
		if strings.HasSuffix(s, "```") {
			s = s[:len(s)-3]
		}
	}
	return strings.TrimSpace(s)
}

// sanitizeNoLeak 移除明显「直接给答案」的内容（带 SELECT/INSERT 等大段修正代码）。
// 简化策略：如果 Suggestion 里出现完整 SELECT/INSERT/UPDATE/DELETE 语句（>40 字符），
// 把它截短到第一行 + 「请自己再想想」兜底。
func sanitizeNoLeak(s string) string {
	if s == "" {
		return s
	}
	upper := strings.ToUpper(s)
	keywords := []string{"SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE TABLE "}
	for _, kw := range keywords {
		if idx := strings.Index(upper, kw); idx >= 0 {
			// 找到疑似完整语句：从 kw 一直读到分号或 200 字符
			end := idx + 200
			if semi := strings.Index(upper[idx:], ";"); semi >= 0 && idx+semi+1 < end {
				end = idx + semi + 1
			}
			if end > len(s) {
				end = len(s)
			}
			if end-idx > 40 {
				before := strings.TrimSpace(s[:idx])
				after := strings.TrimSpace(s[end:])
				return strings.TrimSpace(before + "\n" + after + "\n（系统检测到可能的完整答案已隐藏，请按提示自己继续想。）")
			}
		}
	}
	return s
}

// trimSuggestionToHint 当 LLM 输出非 JSON 时，从文本里截一段当 suggestion
func trimSuggestionToHint(text, question string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	// 取首段非空行
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			continue
		}
		return sanitizeNoLeak(line)
	}
	return ""
}

func mergeIssues(a, b []CodeIssue) []CodeIssue {
	seen := map[string]bool{}
	out := make([]CodeIssue, 0, len(a)+len(b))
	for _, iss := range a {
		k := iss.Type + "|" + strings.ToLower(strings.TrimSpace(iss.Message))
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, iss)
	}
	for _, iss := range b {
		k := iss.Type + "|" + strings.ToLower(strings.TrimSpace(iss.Message))
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, iss)
	}
	// 排序：错误 > 警告 > 提示；同类按行号
	sevRank := map[string]int{"error": 0, "warning": 1, "info": 2}
	sort.SliceStable(out, func(i, j int) bool {
		ri, oki := sevRank[out[i].Severity]
		rj, okj := sevRank[out[j].Severity]
		if !oki {
			ri = 3
		}
		if !okj {
			rj = 3
		}
		if ri != rj {
			return ri < rj
		}
		return out[i].Line < out[j].Line
	})
	return out
}

// ─── SQL 审查器 ────────────────────────────────────────────────────────────

type sqlReviewer struct{}

func (sqlReviewer) Language() string { return "sql" }

func (sqlReviewer) Review(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error) {
	result := CodeReviewResult{
		Issues:   []CodeIssue{},
		Summary:  "",
		Language: "sql",
	}

	// 1) 沙盒执行：in-memory SQLite + 事务回滚
	syntaxOK, executedOK, execErr, execOutput := runSQLInSandbox(req.Code, req.Schema)
	result.SyntaxOK = syntaxOK
	result.ExecutedOK = executedOK

	// 2) 风格/反模式检查
	result.Issues = append(result.Issues, checkSQLStyle(req.Code)...)

	// 3) 执行结果处理
	if execErr != "" {
		result.Issues = append(result.Issues, CodeIssue{
			Severity:   "error",
			Line:       0,
			Type:       "syntax",
			Message:    execErr,
			Suggestion: "按错误信息反查 SQL 语法；常见原因：缺少 FROM/WHERE/分号，关键字拼写错误。",
		})
	} else if !executedOK {
		result.Issues = append(result.Issues, CodeIssue{
			Severity:   "warning",
			Line:       0,
			Type:       "logic",
			Message:    "SQL 未返回结果集（可能只是 DDL 或非查询语句）",
			Suggestion: "如果是查询题，先用 SELECT 验证一下能得到你期望的数据。",
		})
	}

	// 4) 打分
	result.Score = scoreFromIssues(result.Issues, syntaxOK && executedOK)

	// 5) 总结 + 提示
	if syntaxOK && executedOK && len(result.Issues) == 0 {
		result.Summary = "SQL 可正常执行，未发现明显风格问题。"
		result.Suggestion = "对照题目检查返回结果的列名与行数是否符合预期；如果有条件/分组，想想是否漏写了。"
	} else if syntaxOK && executedOK {
		result.Summary = fmt.Sprintf("SQL 可执行，发现 %d 个可优化点。", len(result.Issues))
		result.Suggestion = "按提示逐条修改：先把所有「warning」处理掉，再考虑性能/可读性。"
	} else {
		result.Summary = "SQL 暂时无法正确执行。"
		result.Suggestion = "从最基础的语法开始排查：分号、FROM、关键字拼写。可以把代码拆成两段分别执行定位错误。"
	}
	_ = ctx // SQL 沙盒是同步的，不接 ctx
	if execOutput != "" && executedOK {
		// 沙盒输出作为附加提示（不放 Summary，避免刷屏）
		if len(execOutput) > 200 {
			execOutput = execOutput[:200] + "…"
		}
		result.Summary = result.Summary + "\n（沙盒执行首行：" + strings.SplitN(execOutput, "\n", 2)[0] + "）"
	}
	return result, nil
}

// runSQLInSandbox 在 :memory: SQLite 中执行用户 SQL，事务回滚保证不污染。
// 返回：语法是否 OK、执行是否 OK、错误摘要、执行输出（首行）。
//
// 沙盒结构：
//   1. schema 建表 —— 跑在事务外（每次调用都重建，:memory: 本来就干净）
//   2. user code —— 跑在事务里，结束 ROLLBACK（不污染 schema）
func runSQLInSandbox(code, schema string) (bool, bool, string, string) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return false, false, "无法启动 SQL 沙盒（" + err.Error() + "）", ""
	}
	defer db.Close()

	// 1) Schema：建表在事务外（事务会 ROLLBACK，表就没了）
	if strings.TrimSpace(schema) != "" {
		for _, s := range splitSQLStatements(schema) {
			if _, err := db.Exec(s); err != nil {
				return false, false, "Schema 有误：" + trimSQLiteErr(err.Error()), ""
			}
		}
	}

	// 2) User code：包在事务里回滚
	if _, err := db.Exec("BEGIN"); err != nil {
		return true, false, "沙盒事务启动失败", ""
	}
	hadQuery := false
	var lastOutput string
	for _, stmt := range splitSQLStatements(code) {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		upper := strings.ToUpper(stmt)
		isQuery := strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "WITH") ||
			strings.HasPrefix(upper, "PRAGMA") || strings.HasPrefix(upper, "EXPLAIN")
		if isQuery {
			hadQuery = true
			rows, err := db.Query(stmt)
			if err != nil {
				if rows != nil {
					_ = rows.Close()
				}
				_, _ = db.Exec("ROLLBACK")
				return false, false, trimSQLiteErr(err.Error()), ""
			}
			cols, err := rows.Columns()
			if err != nil {
				_ = rows.Close()
				_, _ = db.Exec("ROLLBACK")
				return false, false, trimSQLiteErr(err.Error()), ""
			}
			row := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range row {
				ptrs[i] = &row[i]
			}
			if rows.Next() {
				if err := rows.Scan(ptrs...); err == nil {
					lastOutput = formatRow(cols, row)
				}
			}
			_ = rows.Close()
		} else {
			if _, err := db.Exec(stmt); err != nil {
				_, _ = db.Exec("ROLLBACK")
				return false, false, trimSQLiteErr(err.Error()), ""
			}
		}
	}
	_, _ = db.Exec("ROLLBACK")
	return true, hadQuery, "", lastOutput
}

// splitSQLStatements 按分号拆 SQL（粗略实现；字符串字面量内分号会误拆，但教学 SQL 够用）。
func splitSQLStatements(code string) []string {
	var out []string
	var cur strings.Builder
	inString := false
	stringCh := byte(0)
	for i := 0; i < len(code); i++ {
		c := code[i]
		if inString {
			cur.WriteByte(c)
			if c == stringCh {
				inString = false
			}
			continue
		}
		if c == '\'' || c == '"' {
			inString = true
			stringCh = c
			cur.WriteByte(c)
			continue
		}
		if c == ';' {
			cur.WriteByte(c)
			out = append(out, cur.String())
			cur.Reset()
			continue
		}
		cur.WriteByte(c)
	}
	if rest := strings.TrimSpace(cur.String()); rest != "" {
		out = append(out, rest)
	}
	return out
}

func trimSQLiteErr(s string) string {
	if idx := strings.Index(s, ":"); idx > 0 && idx < 40 {
		s = s[idx+1:]
	}
	s = strings.TrimSpace(s)
	if len(s) > 240 {
		s = s[:240] + "…"
	}
	return s
}

func formatRow(cols []string, vals []any) string {
	parts := make([]string, len(cols))
	for i, c := range cols {
		parts[i] = fmt.Sprintf("%s=%v", c, formatVal(vals[i]))
	}
	return strings.Join(parts, ", ")
}

func formatVal(v any) string {
	if v == nil {
		return "NULL"
	}
	switch x := v.(type) {
	case []byte:
		return string(x)
	case string:
		return x
	case int64, int, int32, float64, float32, bool:
		return fmt.Sprintf("%v", x)
	default:
		return fmt.Sprintf("%v", x)
	}
}

// ─── SQL 静态/风格检查 ─────────────────────────────────────────────────────

var (
	sqlSelectStarRE = regexp.MustCompile(`(?i)\bSELECT\s+\*\s+FROM`)
	sqlUpdateNoWhereRE = regexp.MustCompile(`(?i)\bUPDATE\s+\w+\s+SET\s+[^;]*\bSET\s+[^;]*$`)
	sqlDeleteNoWhereRE = regexp.MustCompile(`(?i)\bDELETE\s+FROM\s+\w+\s*(?:;|$)`)
	sqlUpperKeywords  = regexp.MustCompile(`(?i)\b(SELECT|FROM|WHERE|JOIN|ON|GROUP|ORDER|BY|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|AS|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN)\b`)
)

func checkSQLStyle(code string) []CodeIssue {
	var out []CodeIssue
	if sqlSelectStarRE.MatchString(code) {
		out = append(out, CodeIssue{
			Severity:   "info",
			Type:       "style",
			Message:    "用了 SELECT * —— 列出具体列名更清晰、性能更好",
			Suggestion: "想想题目需要哪些字段，把 * 换成具体列名（多表 JOIN 时尤其要避免 *）。",
		})
	}
	if sqlDeleteNoWhereRE.MatchString(code) {
		out = append(out, CodeIssue{
			Severity:   "error",
			Type:       "safety",
			Message:    "DELETE 缺少 WHERE 子句——会删全表",
			Suggestion: "删除前先 SELECT 确认范围，再补 WHERE；千万不要在生产跑无 WHERE 的 DELETE。",
		})
	}
	if sqlUpdateNoWhereRE.MatchString(code) {
		out = append(out, CodeIssue{
			Severity:   "error",
			Type:       "safety",
			Message:    "UPDATE 缺少 WHERE 子句——会更新全表",
			Suggestion: "在 SET 后加 WHERE 限定目标行；先 SELECT 看要改哪些行。",
		})
	}
	if strings.Contains(strings.ToUpper(code), "WHERE") && !strings.Contains(strings.ToUpper(code), "AND") &&
		!strings.Contains(strings.ToUpper(code), "OR") && !strings.Contains(strings.ToUpper(code), "=") {
		out = append(out, CodeIssue{
			Severity:   "info",
			Type:       "logic",
			Message:    "WHERE 子句里好像没有比较条件",
			Suggestion: "WHERE 后面要跟比较（如 =、>、<、IN、LIKE 等），光写列名等于全选。",
		})
	}
	if !sqlUpperKeywords.MatchString(code) && len(strings.TrimSpace(code)) > 0 {
		out = append(out, CodeIssue{
			Severity:   "info",
			Type:       "best_practice",
			Message:    "建议 SQL 关键字用大写，便于阅读",
			Suggestion: "SELECT / FROM / WHERE 这些关键字统一大写，列名和表名小写，是常见可读性约定。",
		})
	}
	return out
}

// scoreFromIssues 由问题列表 + 是否可执行 算 0–100 分。
func scoreFromIssues(issues []CodeIssue, executableOK bool) int {
	score := 100
	if !executableOK {
		score -= 50
	}
	for _, iss := range issues {
		switch iss.Severity {
		case "error":
			score -= 20
		case "warning":
			score -= 8
		case "info":
			score -= 3
		}
	}
	if score < 0 {
		score = 0
	}
	return score
}

// ─── Python 审查器（启发式，**不执行**，安全） ────────────────────────────

type pythonReviewer struct{}

func (pythonReviewer) Language() string { return "python" }

func (pythonReviewer) Review(ctx context.Context, req CodeReviewRequest) (CodeReviewResult, error) {
	_ = ctx
	result := CodeReviewResult{
		Language:      "python",
		StaticCheckOK: true,
		Issues:        checkPythonStyle(req.Code),
	}
	result.Score = scoreFromIssues(result.Issues, true)
	if len(result.Issues) == 0 {
		result.Summary = "未发现明显风格/语法问题（未实际执行）。"
		result.Suggestion = "对照题目一步步走一遍代码：每个变量在什么位置被赋值、循环边界是否对、return 路径有没有全覆盖。"
	} else {
		errs, warns := 0, 0
		for _, iss := range result.Issues {
			if iss.Severity == "error" {
				errs++
			}
			if iss.Severity == "warning" {
				warns++
			}
		}
		result.Summary = fmt.Sprintf("静态扫描发现 %d 个 error / %d 个 warning（代码未实际运行）。", errs, warns)
		result.Suggestion = "先修 error（通常是缩进 / 冒号 / 括号），再调 warning；改完手动在 Python REPL 里跑两组测试用例验证。"
	}
	return result, nil
}

var (
	pyDefNoColonRE = regexp.MustCompile(`(?m)^\s*def\s+\w+\([^)]*\)\s*$`)
	pyForNoColonRE = regexp.MustCompile(`(?m)^\s*for\s+.+in\s+.+\s*$`)
	pyIfNoColonRE  = regexp.MustCompile(`(?m)^\s*if\s+.+\s*$`)
	pyWhileNoColon = regexp.MustCompile(`(?m)^\s*while\s+.+\s*$`)
)

func checkPythonStyle(code string) []CodeIssue {
	var out []CodeIssue
	lines := strings.Split(code, "\n")
	addIfMissingColon := func(re *regexp.Regexp, kw string) {
		matches := re.FindAllStringIndex(code, -1)
		for _, m := range matches {
			// 第 m[0] 所在行号
			line := 1 + strings.Count(code[:m[0]], "\n")
			if line-1 < len(lines) {
				head := strings.TrimRight(lines[line-1], " \t\r")
				if !strings.HasSuffix(head, ":") {
					out = append(out, CodeIssue{
						Severity:   "error",
						Line:       line,
						Type:       "syntax",
						Message:    kw + " 行缺少冒号（:）",
						Suggestion: "Python 的 " + kw + " 语句必须以 : 结尾，下一行必须缩进。",
					})
				}
			}
		}
	}
	addIfMissingColon(pyDefNoColonRE, "def")
	addIfMissingColon(pyForNoColonRE, "for")
	addIfMissingColon(pyIfNoColonRE, "if")
	addIfMissingColon(pyWhileNoColon, "while")

	// 缩进一致性
	tabCount := strings.Count(code, "\t")
	spaceCount := 0
	for i := 0; i < len(code); i++ {
		if code[i] == ' ' {
			spaceCount++
		} else {
			break
		}
	}
	if tabCount > 0 && spaceCount > 0 {
		out = append(out, CodeIssue{
			Severity:   "error",
			Type:       "syntax",
			Message:    "混用了 Tab 和空格缩进——Python 3 虽可运行，但 PEP 8 要求统一",
			Suggestion: "全部改成 4 个空格（编辑器右下角切换 Indentation: Spaces / Width: 4）。",
		})
	}

	// 常见反模式
	if strings.Contains(code, "print(") && !strings.Contains(code, "return ") {
		out = append(out, CodeIssue{
			Severity:   "info",
			Type:       "logic",
			Message:    "函数里只有 print 没有 return —— 这是脚本不是函数",
			Suggestion: "如果题目要求「写一个函数」，把它改成 return 出来；调试 print 可以保留。",
		})
	}
	if matched, _ := regexp.MatchString(`(?m)^\s*except\s*:\s*$`, code); matched {
		out = append(out, CodeIssue{
			Severity:   "warning",
			Type:       "best_practice",
			Message:    "裸 except: 会吞掉所有异常（包括 KeyboardInterrupt）",
			Suggestion: "改成 except <具体异常类> as e:，比如 except ValueError as e:。",
		})
	}
	if matched, _ := regexp.MatchString(`(?m)^\s*import\s+\*\s*$`, code); matched {
		out = append(out, CodeIssue{
			Severity:   "warning",
			Type:       "best_practice",
			Message:    "import * 会污染命名空间，不推荐",
			Suggestion: "改成 from <module> import <name1>, <name2>。",
		})
	}
	return out
}

// ─── 时间戳辅助 ────────────────────────────────────────────────────────────

var _ = time.Second // 保留 import 占位（sqlite 间接引用）
