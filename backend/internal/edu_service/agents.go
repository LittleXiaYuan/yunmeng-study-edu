package edu_service

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

const maxKnowledgeAnalysisRunes = 24_000

const knowledgeAnalysisOmissionMarker = "\n\n【为控制分析耗时，已省略部分正文】\n\n"

func (s *Service) teacherAgent(ctx context.Context, req AnalyzeRequest) KnowledgeAnalysis {
	// 已保存的 LLM 配置会通过 OpenAI-compatible chat completion 连接测试，
	// 因此分析也使用同一条已验证路径。DeepSeek/OpenAI 并不提供历史遗留的
	// /v1/knowledge/upload，先调用它只会增加一次无效网络往返。
	analysisContent := compactKnowledgeAnalysisContent(req.Content)
	input := fmt.Sprintf("教案内容：%s\n请输出 JSON：{\"concepts\":[],\"difficulties\":[],\"learning_path\":[]}", analysisContent)
	if text, err := s.agent.Call(ctx, TeacherAgentPrompt, input); err == nil {
		var out KnowledgeAnalysis
		if decodeJSONObject(text, &out) == nil && len(out.Concepts)+len(out.Difficulties)+len(out.LearningPath) > 0 {
			return out
		}
	}
	return fallbackKnowledge(req.Content)
}

func compactKnowledgeAnalysisContent(content string) string {
	trimmed := strings.TrimSpace(content)
	runes := []rune(trimmed)
	if len(runes) <= maxKnowledgeAnalysisRunes {
		return trimmed
	}

	marker := []rune(knowledgeAnalysisOmissionMarker)
	segmentLen := (maxKnowledgeAnalysisRunes - 2*len(marker)) / 3
	middleStart := (len(runes) - segmentLen) / 2
	result := make([]rune, 0, maxKnowledgeAnalysisRunes)
	result = append(result, runes[:segmentLen]...)
	result = append(result, marker...)
	result = append(result, runes[middleStart:middleStart+segmentLen]...)
	result = append(result, marker...)
	result = append(result, runes[len(runes)-segmentLen:]...)
	return string(result)
}

func (s *Service) tutorAgent(ctx context.Context, req ChatRequest, memory StudentMemory) string {
	trust := TrustPolicyFor(memory.TrustScore)
	input := tutorAgentInput(req, memory, trust)
	if text, err := s.agent.Call(ctx, TutorAgentPrompt, input); err == nil && strings.TrimSpace(text) != "" {
		return enforceQuestionOnly(text)
	}
	return defaultTutorQuestionWithPage(req.Question, req.Context, req.PageContext, trust)
}

// tutorAgentStream 与 tutorAgent 同一套 prompt，但边生成边通过 onDelta 吐增量；
// 网关不支持流式或调用失败时，回退为一次性输出（含启发式兜底），保证 LLM-optional。
func (s *Service) tutorAgentStream(ctx context.Context, req ChatRequest, memory StudentMemory, onDelta func(string)) string {
	trust := TrustPolicyFor(memory.TrustScore)
	input := tutorAgentInput(req, memory, trust)
	if streamer, ok := s.agent.(StreamingAgentClient); ok {
		if text, err := streamer.CallStream(ctx, TutorAgentPrompt, input, onDelta); err == nil && strings.TrimSpace(text) != "" {
			trimmed := strings.TrimSpace(text)
			final := enforceQuestionOnly(trimmed)
			// enforceQuestionOnly 只可能在结尾追加引导问句：把追加部分也作为增量吐出
			if suffix := strings.TrimPrefix(final, trimmed); suffix != "" && suffix != final {
				onDelta(suffix)
			}
			return final
		}
	}
	// 回退：网关不支持流式（或流式失败）时走原有整段路径（非流式调用 → 启发式兜底）
	message := s.tutorAgent(ctx, req, memory)
	onDelta(message)
	return message
}

func tutorAgentInput(req ChatRequest, memory StudentMemory, trust TrustPolicy) string {
	return fmt.Sprintf(`【当前屏幕】（学生此刻看到的页面，请当作你已打开同一页面）
%s

【历史对话】
%s

【学生最新问题】
%s

【课程解析】
%s

【知识库检索片段】
%s

【学生画像】
%s

【认知权限 / 信任分策略】
%s

要求：
1. 先结合【当前屏幕】作答：点名题干/阶段/草稿里的具体内容（若有）。
2. 可给脚手架式短提示，但禁止直接写出完整答案或把 expected_hint 原样泄题。
3. 必须以一个引导性提问结尾。`,
		formatPageContext(req.PageContext),
		mustJSON(req.History),
		req.Question,
		mustJSON(req.Context),
		mustJSON(req.Retrieval),
		mustJSON(memory),
		mustJSON(trust),
	)
}

func formatPageContext(pc *PageContext) string {
	if pc == nil {
		return "（无页面上下文：学生可能在自由对话）"
	}
	var b strings.Builder
	write := func(k, v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		b.WriteString(k)
		b.WriteString(v)
		b.WriteString("\n")
	}
	write("场景：", pc.Scene)
	write("课程：", pc.CourseName)
	write("任务：", pc.Title)
	if pc.StepTotal > 0 {
		b.WriteString(fmt.Sprintf("阶段：第 %d / %d 步", pc.StepIndex+1, pc.StepTotal))
		if strings.TrimSpace(pc.StepTitle) != "" {
			b.WriteString(" · ")
			b.WriteString(pc.StepTitle)
		}
		b.WriteString("\n")
	} else {
		write("阶段标题：", pc.StepTitle)
	}
	write("题干/要求：", truncateRunes(pc.Instruction, 1200))
	// expected 仅给教练作「对照缺口」用，prompt 已禁止直接泄题
	write("阶段期望（勿直接复述给学生当答案）：", truncateRunes(pc.ExpectedHint, 400))
	write("学生当前草稿：", truncateRunes(pc.StudentDraft, 800))
	write("页面摘要：", truncateRunes(pc.VisibleSummary, 600))
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "（页面上下文字段为空）"
	}
	return out
}

func truncateRunes(s string, max int) string {
	s = strings.TrimSpace(s)
	if max <= 0 || s == "" {
		return s
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}

func defaultTutorQuestionWithPage(question string, context KnowledgeAnalysis, pc *PageContext, trust TrustPolicy) string {
	if pc != nil {
		step := strings.TrimSpace(pc.StepTitle)
		if step == "" {
			step = strings.TrimSpace(pc.Title)
		}
		draft := strings.TrimSpace(pc.StudentDraft)
		instr := strings.TrimSpace(pc.Instruction)
		switch {
		case draft != "" && trust.CanHint:
			return fmt.Sprintf("我看到你在「%s」已经写下一些内容了。你能指出草稿里哪一句最接近题目要求，以及还缺哪一个关键对象吗？", nonempty(step, "当前步骤"))
		case instr != "" && trust.CanHint:
			return fmt.Sprintf("看着屏幕上的要求，你先用一句话概括「%s」到底要你产出什么？卡在概念、例子，还是落笔结构？", nonempty(step, "这一步"))
		case step != "":
			return fmt.Sprintf("我们先不急着要答案。针对「%s」，你能说说题目在问什么、你目前想到哪、卡在哪吗？", step)
		}
	}
	return defaultTutorQuestion(question, context, trust)
}

func nonempty(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return strings.TrimSpace(v)
}

func (s *Service) evaluatorAgent(ctx context.Context, req EvaluateRequest) Evaluation {
	input := fmt.Sprintf("学生问题：%s\n学生回答：%s\n请输出 JSON：{\"understanding_score\":0,\"really_understood\":false,\"error_types\":[],\"thinking_depth\":0,\"reflection_level\":0,\"question_quality\":0,\"explanation_quality\":0,\"reflection_depth\":0}",
		req.Question, req.Answer)
	if text, err := s.agent.Call(ctx, EvaluatorAgentPrompt, input); err == nil {
		var out Evaluation
		if decodeJSONObject(text, &out) == nil {
			return normalizeEvaluation(out)
		}
	}
	return heuristicEvaluation(req.Answer)
}

func (s *Service) homeworkStepEvaluatorAgent(ctx context.Context, homework HomeworkTask, step HomeworkStep, answer string) Evaluation {
	input := fmt.Sprintf(`你是《数据库原理与应用》课程的阶段作业评分器。
请只评价学生是否完成当前阶段要求，不要因为答案没有反思、没有提问、没有“例如/因为”等词而扣分。

作业标题：%s
总任务：%s
当前阶段：%s
阶段要求：%s
阶段期望：%s
学生答案：%s

评分标准：
- 85-100：覆盖阶段期望的大部分关键对象/关系/字段，表达清楚，可以进入下一阶段。
- 65-84：基本完成，但有少量遗漏，可以进入下一阶段，并给出补充建议。
- 40-64：只写到部分概念，暂不进入下一阶段。
- 0-39：偏题、太短或没有回答当前阶段。

请只输出 JSON，不要 Markdown，不要解释：
{"understanding_score":0,"really_understood":false,"error_types":[],"thinking_depth":0,"reflection_level":0,"question_quality":80,"explanation_quality":0,"reflection_depth":60}`,
		homework.Title,
		homework.Prompt,
		step.Title,
		step.Instruction,
		step.Expected,
		answer,
	)
	if text, err := s.agent.Call(ctx, EvaluatorAgentPrompt, input); err == nil {
		var out Evaluation
		if decodeJSONObject(text, &out) == nil {
			return normalizeHomeworkEvaluation(out)
		}
	}
	return heuristicHomeworkStepEvaluation(step, answer)
}

func (s *Service) reflectorAgent(ctx context.Context, req ReportRequest, memories []StudentMemory) Report {
	input := fmt.Sprintf("班级/学生数据：%s\n请输出 JSON：{\"common_problems\":[],\"suggestions\":[],\"strategies\":[]}", mustJSON(memories))
	if text, err := s.agent.Call(ctx, ReflectorAgentPrompt, input); err == nil {
		var out Report
		if decodeJSONObject(text, &out) == nil && len(out.CommonProblems)+len(out.Suggestions)+len(out.Strategies) > 0 {
			out.Scope = reportScope(req)
			out.StudentID = req.StudentID
			out.ClassID = req.ClassID
			out.GeneratedAt = nowString()
			out.PromptUsed = ReflectorAgentPrompt
			return out
		}
	}
	return fallbackReport(req, memories)
}

func heuristicDirective(req AgentCommandRequest) AgentDirective {
	text := strings.TrimSpace(req.Message)
	hasCreateVerb := containsAny(text, "新建", "创建", "新增", "建立", "添加")
	ctx := req.Context
	switch {
	// More specific intents first.
	case containsAny(text, "导入名单", "批量导入", "花名册", "学生名单导入", "批量建号") ||
		(containsAny(text, "导入", "批量") && containsAny(text, "学生", "名单", "账号")):
		return AgentDirective{
			Reply:  "可以批量导入学生：粘贴「姓名,账号,密码」或上传名单文件后确认创建。",
			Intent: "import_students",
			Cards: []AgentCard{{
				Type:  "confirm",
				Title: "批量导入学生",
				Body:  "将打开名单导入面板；支持粘贴 CSV/文本，确认后写入后端并可选创建登录账号。",
				Items: []string{"格式示例：张三,student_zhang,123456", "也可只写姓名，系统按规则生成账号"},
			}},
			Choices: []AgentChoice{
				{Label: "打开导入面板", Action: "import_students", Style: "primary"},
				{Label: "打开学生名单", Action: "open_panel", Payload: map[string]string{"panel": "student-list"}, Style: "secondary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	case containsAny(text, "报告", "班级情况", "共性问题", "学情"):
		return AgentDirective{
			Reply:  "已为你汇总班级报告入口。",
			Intent: "class_report",
			Cards: []AgentCard{{
				Type:  "data",
				Title: "班级报告",
				Body:  "结合当前工作台数据查看共性与建议。",
			}},
			Choices: []AgentChoice{
				{Label: "生成报告要点", Action: "send_command", Payload: map[string]string{"command": "class_report"}, Style: "primary"},
				{Label: "打开班级画像", Action: "open_panel", Payload: map[string]string{"panel": "class-profile"}, Style: "secondary"},
			},
		}
	case containsAny(text, "知识点", "拆解", "难点分析", "知识拆解", "备课"):
		return AgentDirective{
			Reply:  "已为你准备知识点拆解请求，确认后将调用 TeacherAgent 解析。",
			Intent: "knowledge_analysis",
			Cards: []AgentCard{{
				Type:  "confirm",
				Title: "知识点拆解",
				Body:  "将解析你提供的内容，拆解出概念、难点与学习路径。",
			}},
			Choices: []AgentChoice{
				{Label: "开始拆解", Action: "send_command", Payload: map[string]string{"command": "knowledge_analysis"}, Style: "primary"},
			},
		}
	case containsAny(text, "资料", "上传", "教案", "zip", "pdf", "docx", "导入资料", "知识库"):
		hasAttach := containsAny(ctx, "附件", "已选文件", "file")
		body := "打开资料导入面板，支持 zip/pdf/docx；Agent 会筛选噪声并写入知识库。"
		if hasAttach {
			body = "检测到对话区已挂附件。确认后将按智能导入规则写入课程知识库。"
		}
		return AgentDirective{
			Reply:  "教案/资料可以导入知识库：有用正文入库，名单类噪声会跳过。",
			Intent: "upload_materials",
			Cards: []AgentCard{{
				Type:  "confirm",
				Title: "导入课程资料",
				Body:  body,
			}},
			Choices: []AgentChoice{
				{Label: "确认导入附件/打开面板", Action: "upload_materials", Style: "primary"},
				{Label: "打开导入面板", Action: "open_panel", Payload: map[string]string{"panel": "materials-upload"}, Style: "secondary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	case containsAny(text, "名单", "花名册", "学生列表", "看学生"):
		return AgentDirective{
			Reply:  "可以打开学生名单，或继续批量导入。",
			Intent: "open_panel",
			Cards: []AgentCard{{
				Type:  "info",
				Title: "学生名单",
				Body:  "浏览学情与信任分，或批量导入新学生。",
			}},
			Choices: []AgentChoice{
				{Label: "打开名单", Action: "open_panel", Payload: map[string]string{"panel": "student-list"}, Style: "primary"},
				{Label: "批量导入", Action: "import_students", Style: "secondary"},
			},
		}
	case containsAny(text, "发布", "布置任务", "作业发布"):
		return AgentDirective{
			Reply:  "已生成发布作业的确认卡片，请检查后确认发布。",
			Intent: "publish_homework",
			Cards: []AgentCard{{
				Type:  "confirm",
				Title: "发布作业",
				Body:  "确认后将把该作业发布给对应班级的学生。",
			}},
			Choices: []AgentChoice{
				{Label: "确认发布", Action: "publish_homework", Style: "primary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	case containsAny(text, "建班") || (hasCreateVerb && strings.Contains(text, "班级")):
		return AgentDirective{
			Reply:  "已根据你的指令准备好新建班级的表单，请确认信息后提交。",
			Intent: "create_class",
			Cards: []AgentCard{{
				Type:   "form_prefill",
				Title:  "新建班级",
				Body:   "请确认班级名称与年级后创建。",
				Fields: map[string]string{"name": inferTitle(text, "新班级"), "grade": ""},
			}},
			Choices: []AgentChoice{
				{Label: "确认创建", Action: "create_class", Style: "primary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	case containsAny(text, "开课") || (hasCreateVerb && strings.Contains(text, "课程")):
		return AgentDirective{
			Reply:  "已根据你的指令准备好新建课程的表单，请确认信息后提交。",
			Intent: "create_course",
			Cards: []AgentCard{{
				Type:   "form_prefill",
				Title:  "新建课程",
				Body:   "请确认课程名称与所属班级后创建。",
				Fields: map[string]string{"name": inferTitle(text, "新课程"), "class_id": ""},
			}},
			Choices: []AgentChoice{
				{Label: "确认创建", Action: "create_course", Style: "primary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	case hasCreateVerb && containsAny(text, "学生", "账号"):
		return AgentDirective{
			Reply:  "已根据你的指令准备好新建学生的表单，请确认信息后提交。",
			Intent: "create_student",
			Cards: []AgentCard{{
				Type:   "form_prefill",
				Title:  "新建学生",
				Body:   "请确认学生姓名与所属班级后创建。",
				Fields: map[string]string{"name": inferTitle(text, "新学生"), "class_id": ""},
			}},
			Choices: []AgentChoice{
				{Label: "确认创建", Action: "create_student", Style: "primary"},
				{Label: "取消", Action: "dismiss", Style: "secondary"},
			},
		}
	default:
		return AgentDirective{
			Reply:  "我可以帮你新建班级/课程/学生、发布作业、查看班级报告或拆解知识点，请告诉我具体需要做什么。",
			Intent: "chat",
		}
	}
}

func containsAny(text string, keywords ...string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}

func fallbackKnowledge(content string) KnowledgeAnalysis {
	terms := extractTerms(content)
	if len(terms) == 0 {
		terms = []string{"核心概念", "关键方法", "应用场景"}
	}
	return KnowledgeAnalysis{
		Concepts:     terms,
		Difficulties: []string{"概念边界不清", "迁移应用不足", "反思表达不足"},
		LearningPath: []string{"激活已有经验", "解释核心概念", "对比典型误区", "完成举例迁移", "进行元认知反思"},
	}
}

func heuristicEvaluation(answer string) Evaluation {
	length := len([]rune(strings.TrimSpace(answer)))
	score := 20
	if length > 20 {
		score += 20
	}
	if strings.Contains(answer, "因为") || strings.Contains(answer, "所以") {
		score += 15
	}
	if strings.Contains(answer, "例如") || strings.Contains(answer, "比如") {
		score += 15
	}
	if strings.Contains(answer, "我认为") || strings.Contains(answer, "反思") || strings.Contains(answer, "不确定") {
		score += 15
	}
	if score > 100 {
		score = 100
	}
	reflection := 20
	if strings.Contains(answer, "反思") || strings.Contains(answer, "不确定") {
		reflection = 70
	}
	depth := score
	errors := []string{}
	if length < 20 {
		errors = append(errors, "解释过短")
	}
	if !strings.Contains(answer, "例如") && !strings.Contains(answer, "比如") {
		errors = append(errors, "缺少举例")
	}
	if !strings.Contains(answer, "因为") && !strings.Contains(answer, "所以") {
		errors = append(errors, "因果说明不足")
	}
	return normalizeEvaluation(Evaluation{
		UnderstandingScore: score,
		ReallyUnderstood:   score >= 70,
		ErrorTypes:         errors,
		ThinkingDepth:      depth,
		ReflectionLevel:    reflection,
		QuestionQuality:    20,
		ExplanationQuality: score / 2,
		ReflectionDepth:    reflection / 2,
	})
}

func heuristicHomeworkStepEvaluation(step HomeworkStep, answer string) Evaluation {
	text := strings.TrimSpace(answer)
	expected := step.Title + " " + step.Instruction + " " + step.Expected
	score := 20
	for _, keyword := range []string{"老人", "家属", "护工", "服务项目", "预约", "订单", "健康记录", "评价", "字段", "数据项", "实体", "关系", "主键", "外键", "约束"} {
		if strings.Contains(text, keyword) {
			score += 6
		}
	}
	if len([]rune(text)) >= 80 {
		score += 12
	}
	if len([]rune(text)) >= 160 {
		score += 8
	}
	if strings.Contains(expected, "数据字典") && strings.Contains(text, "ID") && strings.Contains(text, "记录") {
		score += 12
	}
	if strings.Contains(expected, "E-R") && (strings.Contains(text, "一对多") || strings.Contains(text, "多对多")) {
		score += 14
	}
	if strings.Contains(expected, "主键") && strings.Contains(text, "外键") {
		score += 14
	}
	if score > 92 {
		score = 92
	}
	errors := []string{}
	if score < 65 {
		errors = append(errors, "当前阶段覆盖不足")
	}
	return normalizeHomeworkEvaluation(Evaluation{
		UnderstandingScore: score,
		ReallyUnderstood:   score >= 65,
		ErrorTypes:         errors,
		ThinkingDepth:      score,
		ReflectionLevel:    60,
		QuestionQuality:    80,
		ExplanationQuality: score,
		ReflectionDepth:    60,
	})
}

func normalizeEvaluation(e Evaluation) Evaluation {
	e.UnderstandingScore = clamp(e.UnderstandingScore)
	e.ThinkingDepth = clamp(e.ThinkingDepth)
	e.ReflectionLevel = clamp(e.ReflectionLevel)
	e.QuestionQuality = clamp(e.QuestionQuality)
	e.ExplanationQuality = clamp(e.ExplanationQuality)
	e.ReflectionDepth = clamp(e.ReflectionDepth)
	e.ReallyUnderstood = e.UnderstandingScore >= 70 && e.ThinkingDepth >= 60
	if e.ErrorTypes == nil {
		e.ErrorTypes = []string{}
	}
	return e
}

func normalizeHomeworkEvaluation(e Evaluation) Evaluation {
	if e.ThinkingDepth == 0 {
		e.ThinkingDepth = e.UnderstandingScore
	}
	if e.ExplanationQuality == 0 {
		e.ExplanationQuality = e.UnderstandingScore
	}
	if e.QuestionQuality == 0 {
		e.QuestionQuality = 80
	}
	if e.ReflectionDepth == 0 {
		e.ReflectionDepth = 60
	}
	if e.ReflectionLevel == 0 {
		e.ReflectionLevel = 60
	}
	e = normalizeEvaluation(e)
	e.ReallyUnderstood = e.ReallyUnderstood || (e.UnderstandingScore >= 65 && e.ExplanationQuality >= 55)
	return e
}

func homeworkTrustScore(e Evaluation) int {
	return clamp((clamp(e.UnderstandingScore)*45 + clamp(e.ExplanationQuality)*35 + clamp(e.ThinkingDepth)*20) / 100)
}

func enforceQuestionOnly(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return "你能先用自己的话解释这个问题在问什么吗？再举一个你熟悉的例子，并说说你哪里最不确定？"
	}
	if strings.ContainsAny(text, "？?") {
		return text
	}
	return text + "\n(思考：基于以上，你觉得接下来该怎么做呢？)"
}

func defaultTutorQuestion(question string, context KnowledgeAnalysis, trust TrustPolicy) string {
	if isDatabaseDesignQuestion(question, context) {
		return databaseDesignTutorQuestion(question, trust)
	}
	switch {
	case trust.CanExplain:
		return "在我给出完整解释前，你能先说出你的理解路径、一个例子，以及你判断自己已经理解的依据吗？"
	case trust.CanPartial:
		return "你已经可以获得部分答案，但先请你指出：这个问题的关键概念是什么？你能举一个相反例子吗？"
	case trust.CanHint:
		return "我可以给提示：先找概念之间的关系。你能用自己的话解释每个概念，并举一个生活中的例子吗？"
	default:
		_ = question
		return "你先不要急着要答案。你能用自己的话解释题目在问什么、你卡在哪里、以及你能想到的一个例子吗？"
	}
}

func isDatabaseDesignQuestion(question string, context KnowledgeAnalysis) bool {
	text := question + " " + strings.Join(context.Concepts, " ") + " " + strings.Join(context.LearningPath, " ")
	for _, keyword := range []string{"数据库设计", "数据库", "建表", "ER", "E-R", "实体关系", "关系模式", "主键", "外键"} {
		if strings.Contains(strings.ToLower(text), strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

func databaseDesignTutorQuestion(question string, trust TrustPolicy) string {
	domain := inferDatabaseDesignDomain(question)
	switch {
	case trust.CanExplain:
		return "我可以陪你把「" + domain + "」数据库设计一步步做出来，但先不直接给表结构。请你先回答：1）这个系统里有哪些角色？2）一条完整业务流程是什么？3）你认为哪些信息必须被长期保存？回答后我们再一起判断哪些是实体、关系和属性。"
	case trust.CanPartial:
		return "可以先给你一个设计框架：业务场景 -> 实体 -> 关系 -> 字段 -> 主外键 -> 规范化。请你先用「" + domain + "」举一个完整场景，例如谁发起服务、谁接单、服务如何完成、结果如何记录？你觉得这个场景里至少会出现哪 4 个实体？"
	case trust.CanHint:
		return "先给你一个提示：不要一上来建表，先拆业务。围绕「" + domain + "」，你能先列出 3 类用户、2 个核心服务流程、以及每个流程里需要保存的关键数据吗？再说说哪些数据之间可能是一对多或多对多关系。"
	default:
		return "先不要急着要完整答案。请你先用自己的话解释「" + domain + "」这个系统要解决什么问题，并举一个具体场景：哪位老人提出了什么服务需求、谁来处理、最后系统需要记录什么？"
	}
}

func inferDatabaseDesignDomain(question string) string {
	for _, keyword := range []string{"智慧养老服务", "智慧养老", "养老服务"} {
		if strings.Contains(question, keyword) {
			return keyword
		}
	}
	return "这个业务场景"
}

func decodeJSONObject(text string, target any) error {
	text = strings.TrimSpace(text)
	if err := json.Unmarshal([]byte(text), target); err == nil {
		return nil
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end > start {
		return json.Unmarshal([]byte(text[start:end+1]), target)
	}
	return fmt.Errorf("no json object found")
}

func mustJSON(value any) string {
	data, _ := json.Marshal(value)
	return string(data)
}

func extractTerms(content string) []string {
	re := regexp.MustCompile(`[\p{Han}A-Za-z0-9]{2,}`)
	matches := re.FindAllString(content, -1)
	seen := map[string]bool{}
	out := []string{}
	for _, item := range matches {
		if len([]rune(item)) > 16 || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
		if len(out) == 6 {
			break
		}
	}
	return out
}
