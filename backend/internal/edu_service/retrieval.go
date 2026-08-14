package edu_service

import (
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

// 分块参数：过长教案按段落切，检索命中「段落」而非整篇标题。
const (
	chunkTargetRunes = 220
	chunkOverlap     = 40
	defaultHitLimit  = 5
)

func searchLessonsInState(state PlatformState, query string, courseID string, limit int) []RetrievalHit {
	query = strings.TrimSpace(query)
	courseID = strings.TrimSpace(courseID)
	if limit < 1 {
		limit = defaultHitLimit
	}
	terms := retrievalTerms(query)
	type scored struct {
		hit   RetrievalHit
		score int
	}
	var ranked []scored

	for _, lesson := range state.Lessons {
		if lesson.Archived {
			continue
		}
		if courseID != "" && lesson.CourseID != courseID {
			continue
		}
		// 整篇粗分 + 各 chunk 细分，取最高分 chunk 作为该课命中
		bestScore := retrievalScore(lesson, query, terms)
		bestSnippet := retrievalSnippet(lesson.Content, query, terms)
		chunks := chunkLessonContent(lesson.Content)
		for i, chunk := range chunks {
			cs := chunkScore(lesson, chunk, query, terms, i, len(chunks))
			if cs > bestScore {
				bestScore = cs
				bestSnippet = retrievalSnippet(chunk, query, terms)
			}
		}
		if bestScore <= 0 && query != "" {
			continue
		}
		if bestScore <= 0 {
			bestScore = 1
		}
		hit := RetrievalHit{
			LessonID: lesson.ID,
			CourseID: lesson.CourseID,
			Title:    lesson.Title,
			Snippet:  bestSnippet,
			Concepts: limitStrings(lesson.Analysis.Concepts, 5),
			Score:    bestScore,
		}
		ranked = append(ranked, scored{hit: hit, score: bestScore})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].score == ranked[j].score {
			return ranked[i].hit.Title < ranked[j].hit.Title
		}
		return ranked[i].score > ranked[j].score
	})
	// 同课只保留最高分一条；再取 limit
	seenLesson := map[string]bool{}
	hits := []RetrievalHit{}
	for _, r := range ranked {
		if seenLesson[r.hit.LessonID] {
			continue
		}
		seenLesson[r.hit.LessonID] = true
		hits = append(hits, r.hit)
		if len(hits) >= limit {
			break
		}
	}
	return hits
}

func retrievalTerms(query string) []string {
	terms := tokenizeQuery(query)
	if len(terms) == 0 && strings.TrimSpace(query) != "" {
		terms = []string{strings.TrimSpace(query)}
	}
	return limitStrings(terms, 16)
}

// tokenizeQuery：中英混合分词。
// - 英文/数字：连续 token
// - 中文：单字 + 双字（bigram），提升「外键/主键」类短词命中
func tokenizeQuery(query string) []string {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	add := func(t string) {
		t = strings.TrimSpace(strings.ToLower(t))
		if t == "" || seen[t] {
			return
		}
		// 过短英文跳过
		if isASCIIWord(t) && utf8.RuneCountInString(t) < 2 {
			return
		}
		seen[t] = true
		out = append(out, t)
	}

	var buf strings.Builder
	flushASCII := func() {
		if buf.Len() > 0 {
			add(buf.String())
			buf.Reset()
		}
	}

	runes := []rune(query)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		switch {
		case unicode.Is(unicode.Han, r):
			flushASCII()
			add(string(r))
			if i+1 < len(runes) && unicode.Is(unicode.Han, runes[i+1]) {
				add(string([]rune{r, runes[i+1]}))
			}
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			buf.WriteRune(unicode.ToLower(r))
		default:
			flushASCII()
		}
	}
	flushASCII()

	// 保留原 extractTerms 风格的 2+ 连续匹配作补充
	for _, t := range extractTerms(query) {
		add(t)
	}
	return out
}

func isASCIIWord(s string) bool {
	for _, r := range s {
		if r > 127 {
			return false
		}
	}
	return true
}

func retrievalScore(lesson Lesson, query string, terms []string) int {
	score := 0
	title := strings.ToLower(lesson.Title)
	content := strings.ToLower(lesson.Content)
	concepts := strings.ToLower(strings.Join(lesson.Analysis.Concepts, " "))
	difficulties := strings.ToLower(strings.Join(lesson.Analysis.Difficulties, " "))
	path := strings.ToLower(strings.Join(lesson.Analysis.LearningPath, " "))
	whole := strings.ToLower(strings.TrimSpace(query))

	if whole != "" {
		if strings.Contains(title, whole) {
			score += 80
		}
		if strings.Contains(content, whole) {
			score += 40
		}
		if strings.Contains(concepts, whole) {
			score += 55
		}
	}
	matchedTerms := 0
	for _, term := range terms {
		term = strings.ToLower(strings.TrimSpace(term))
		if term == "" {
			continue
		}
		hit := false
		if strings.Contains(title, term) {
			score += 28
			hit = true
		}
		if strings.Contains(concepts, term) {
			score += 22
			hit = true
		}
		if strings.Contains(difficulties, term) {
			score += 12
			hit = true
		}
		if strings.Contains(path, term) {
			score += 8
			hit = true
		}
		// 正文：按出现次数衰减加权
		if n := strings.Count(content, term); n > 0 {
			bonus := 14 + minInt(n, 5)*3
			score += bonus
			hit = true
		}
		if hit {
			matchedTerms++
		}
	}
	// 多词同时命中加分（覆盖度）
	if len(terms) > 1 && matchedTerms > 1 {
		score += matchedTerms * 6
	}
	if lesson.AnalysisDone {
		score += 4
	}
	// 正文过短降权
	if utf8.RuneCountInString(strings.TrimSpace(lesson.Content)) < 20 {
		score = score * 3 / 4
	}
	return score
}

func chunkScore(lesson Lesson, chunk, query string, terms []string, chunkIndex, chunkTotal int) int {
	// 把 chunk 当作「伪 lesson 正文」复用部分逻辑
	pseudo := lesson
	pseudo.Content = chunk
	score := retrievalScore(pseudo, query, terms)
	// 标题命中已在 retrievalScore；chunk 位置略微偏好前部
	if chunkTotal > 1 && chunkIndex == 0 {
		score += 2
	}
	return score
}

func chunkLessonContent(content string) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	// 先按空行/段落切
	paras := splitParagraphs(content)
	var chunks []string
	var cur strings.Builder
	curLen := 0
	flush := func() {
		t := strings.TrimSpace(cur.String())
		if t != "" {
			chunks = append(chunks, t)
		}
		cur.Reset()
		curLen = 0
	}
	for _, p := range paras {
		pr := []rune(p)
		if curLen+len(pr) > chunkTargetRunes && curLen > 0 {
			flush()
		}
		if curLen > 0 {
			cur.WriteString("\n")
			curLen++
		}
		cur.WriteString(p)
		curLen += len(pr)
		if curLen >= chunkTargetRunes {
			// 保留 overlap：重开一块带尾部
			full := cur.String()
			flush()
			if chunkOverlap > 0 {
				rs := []rune(full)
				if len(rs) > chunkOverlap {
					tail := string(rs[len(rs)-chunkOverlap:])
					cur.WriteString(tail)
					curLen = chunkOverlap
				}
			}
		}
	}
	flush()
	if len(chunks) == 0 {
		return []string{content}
	}
	return chunks
}

func splitParagraphs(content string) []string {
	parts := strings.FieldsFunc(content, func(r rune) bool {
		return r == '\n'
	})
	out := []string{}
	var buf []string
	for _, line := range parts {
		line = strings.TrimSpace(line)
		if line == "" {
			if len(buf) > 0 {
				out = append(out, strings.Join(buf, " "))
				buf = nil
			}
			continue
		}
		buf = append(buf, line)
	}
	if len(buf) > 0 {
		out = append(out, strings.Join(buf, " "))
	}
	if len(out) == 0 {
		return []string{content}
	}
	return out
}

func lessonRetrievalHit(lesson Lesson, query string, terms []string, score int) RetrievalHit {
	return RetrievalHit{
		LessonID: lesson.ID,
		CourseID: lesson.CourseID,
		Title:    lesson.Title,
		Snippet:  retrievalSnippet(lesson.Content, query, terms),
		Concepts: limitStrings(lesson.Analysis.Concepts, 5),
		Score:    score,
	}
}

func retrievalSnippet(content string, query string, terms []string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return "该资料尚未写入正文。"
	}
	needle := strings.TrimSpace(query)
	if needle == "" && len(terms) > 0 {
		// 优先较长 term
		best := terms[0]
		for _, t := range terms {
			if utf8.RuneCountInString(t) > utf8.RuneCountInString(best) {
				best = t
			}
		}
		needle = best
	}
	index := -1
	if needle != "" {
		index = strings.Index(strings.ToLower(content), strings.ToLower(needle))
	}
	if index < 0 {
		for _, term := range terms {
			if strings.TrimSpace(term) == "" {
				continue
			}
			index = strings.Index(strings.ToLower(content), strings.ToLower(term))
			if index >= 0 {
				break
			}
		}
	}
	runes := []rune(content)
	const window = 160
	const before = 48
	if index < 0 {
		if len(runes) > window {
			return string(runes[:window]) + "..."
		}
		return content
	}
	prefixRunes := []rune(content[:index])
	start := len(prefixRunes) - before
	if start < 0 {
		start = 0
	}
	end := start + window
	if end > len(runes) {
		end = len(runes)
	}
	snippet := string(runes[start:end])
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(runes) {
		snippet += "..."
	}
	return snippet
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
