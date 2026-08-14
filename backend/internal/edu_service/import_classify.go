package edu_service

import (
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// 导入意图 / 内容类型：让「上传」更像 Agent 办事，而不是无脑入库。
const (
	ImportKindLesson   = "lesson"
	ImportKindHomework = "homework"
	ImportKindOutline  = "outline"
	ImportKindNoise    = "noise"
	ImportKindUnknown  = "unknown"

	ImportIntentIngestLessons  = "ingest_lessons"
	ImportIntentBuildHomework  = "build_homework"
	ImportIntentMixedMaterials = "mixed_materials"
	ImportIntentMostlyNoise    = "mostly_noise"
)

// classifyImportedContent 用文件名 + 正文启发式判断是否值得写入教案库。
// 不依赖 LLM，保证无 Key / 离线也可演示「聪明筛选」。
func classifyImportedContent(fileName, title, content string) (kind string, confidence int, reason string) {
	name := strings.ToLower(filepath.Base(strings.ReplaceAll(fileName, "\\", "/")))
	titleLower := strings.ToLower(strings.TrimSpace(title))
	body := strings.TrimSpace(content)
	runes := utf8.RuneCountInString(body)

	// 空 / 极短
	if runes < 40 {
		return ImportKindNoise, 92, "正文过短，更像备注或解析失败，已跳过入库"
	}

	// 文件名噪声
	noiseNameHints := []string{
		"名单", "签到", "考勤", "成绩单", "成绩表", "座位", "照片", "截图",
		"readme", "目录仅", "desktop.ini", "thumbs", "答题卡空白",
	}
	for _, h := range noiseNameHints {
		if strings.Contains(name, h) || strings.Contains(titleLower, h) {
			return ImportKindNoise, 88, "文件名像行政/名单类材料，未当作教案入库"
		}
	}

	// 花名册：大量短行 + 学号模式
	if looksLikeRoster(body) {
		return ImportKindNoise, 90, "内容像学生名单/花名册，已过滤"
	}

	homeworkName := strings.Contains(name, "作业") || strings.Contains(name, "练习") ||
		strings.Contains(name, "习题") || strings.Contains(name, "homework") ||
		strings.Contains(name, "exercise") || strings.Contains(titleLower, "作业") ||
		strings.Contains(titleLower, "练习")
	outlineName := strings.Contains(name, "大纲") || strings.Contains(name, "日历") ||
		strings.Contains(name, "syllabus") || strings.Contains(titleLower, "教学大纲")

	lessonHints := []string{
		"教案", "讲义", "课件", "章节", "第", "章", "课", "知识点", "教学目标",
		"学习目标", "重点", "难点", "关系模型", "范式", "事务", "sql", "数据库",
		"主键", "外键", "索引", "er", "概念", "lesson", "lecture", "chapter",
	}
	homeworkHints := []string{
		"请完成", "提交", "截止", "分值", "题目", "选择题", "简答题", "编程题",
		"第一题", "1.", "（1）", "(1)", "homework", "assignment", "必做", "选做",
	}

	bodyLower := strings.ToLower(body)
	lessonScore := 0
	hwScore := 0
	for _, h := range lessonHints {
		if strings.Contains(bodyLower, h) || strings.Contains(name, h) || strings.Contains(titleLower, h) {
			lessonScore += 2
		}
	}
	for _, h := range homeworkHints {
		if strings.Contains(bodyLower, h) || strings.Contains(name, h) {
			hwScore += 2
		}
	}
	if runes >= 200 {
		lessonScore += 2
	}
	if runes >= 800 {
		lessonScore += 2
	}
	// 问号多 → 更像习题
	if strings.Count(body, "？")+strings.Count(body, "?") >= 3 {
		hwScore += 3
	}

	switch {
	case homeworkName && hwScore >= lessonScore:
		return ImportKindHomework, clamp(70+hwScore), "识别为练习/作业材料，写入资料库供出题与检索引用"
	case outlineName && runes < 2500:
		return ImportKindOutline, 78, "识别为大纲/计划类文本，仍入库便于检索"
	case lessonScore >= 4 || runes >= 300:
		conf := clamp(60 + lessonScore)
		if conf > 96 {
			conf = 96
		}
		return ImportKindLesson, conf, "识别为教案/讲义正文，写入课程知识库并完成概念解析"
	case hwScore > lessonScore && hwScore >= 4:
		return ImportKindHomework, clamp(65+hwScore), "正文更像习题集，入库后可用于自动出题"
	case runes >= 120:
		return ImportKindUnknown, 55, "未明确类型，保守入库并交由 TeacherAgent 解析"
	default:
		return ImportKindNoise, 80, "信息量不足且缺少教学特征，已跳过"
	}
}

func looksLikeRoster(body string) bool {
	lines := strings.Split(body, "\n")
	if len(lines) < 8 {
		return false
	}
	short := 0
	idLike := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		r := utf8.RuneCountInString(line)
		if r <= 16 {
			short++
		}
		// 学号/手机号碎片
		digits := 0
		for _, ch := range line {
			if ch >= '0' && ch <= '9' {
				digits++
			}
		}
		if digits >= 6 && r <= 24 {
			idLike++
		}
	}
	n := len(lines)
	return short*100/n >= 70 && (idLike >= 3 || short >= 12)
}

func summarizeImportIntent(kinds []string) (intent, label, summary string) {
	var lesson, hw, outline, noise, unknown int
	for _, k := range kinds {
		switch k {
		case ImportKindLesson:
			lesson++
		case ImportKindHomework:
			hw++
		case ImportKindOutline:
			outline++
		case ImportKindNoise:
			noise++
		default:
			unknown++
		}
	}
	accepted := lesson + hw + outline + unknown
	total := accepted + noise
	if total == 0 {
		return ImportIntentMostlyNoise, "无有效材料", "未解析到可处理文件"
	}
	switch {
	case accepted == 0:
		return ImportIntentMostlyNoise, "多为无关材料", "已过滤噪声文件，未写入知识库。请上传教案/讲义/习题正文。"
	case hw > 0 && lesson == 0 && outline == 0:
		return ImportIntentBuildHomework, "构建练习资料", "Agent 判断本次以上传练习/作业为主，已入库供检索与自动出题。"
	case lesson > 0 && hw == 0:
		return ImportIntentIngestLessons, "充实教案知识库", "Agent 判断本次为教案导入：有用正文已写入知识库并完成解析，噪声已跳过。"
	default:
		return ImportIntentMixedMaterials, "混合教学资料", "同时识别到教案与练习等材料，已分类入库；无关文件已过滤。"
	}
}

func kindLabelZH(kind string) string {
	switch kind {
	case ImportKindLesson:
		return "教案"
	case ImportKindHomework:
		return "练习"
	case ImportKindOutline:
		return "大纲"
	case ImportKindNoise:
		return "噪声"
	default:
		return "待定"
	}
}
