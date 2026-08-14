package edu_service

import "testing"

func TestTokenizeQueryChineseBigram(t *testing.T) {
	terms := tokenizeQuery("什么是外键约束")
	if len(terms) < 2 {
		t.Fatalf("expected multiple terms, got %#v", terms)
	}
	hasBigram := false
	for _, term := range terms {
		if term == "外键" || term == "约束" {
			hasBigram = true
			break
		}
	}
	if !hasBigram {
		t.Fatalf("expected 外键/约束 style tokens, got %#v", terms)
	}
}

func TestSearchLessonsPrefersMatchingContent(t *testing.T) {
	state := PlatformState{
		Lessons: []Lesson{
			{
				ID:       "l1",
				CourseID: "c1",
				Title:    "绪论",
				Content:  "数据库系统概述，介绍数据管理历史。",
				Analysis: KnowledgeAnalysis{Concepts: []string{"数据库"}},
			},
			{
				ID:       "l2",
				CourseID: "c1",
				Title:    "完整性约束",
				Content:  "主键唯一标识元组。外键引用另一关系的主键，实现参照完整性。",
				Analysis: KnowledgeAnalysis{Concepts: []string{"主键", "外键", "参照完整性"}},
				AnalysisDone: true,
			},
		},
	}
	hits := searchLessonsInState(state, "外键是什么", "c1", 3)
	if len(hits) == 0 {
		t.Fatal("expected hits")
	}
	if hits[0].LessonID != "l2" {
		t.Fatalf("expected l2 first, got %#v", hits)
	}
	if hits[0].Score <= 0 {
		t.Fatalf("expected positive score, got %d", hits[0].Score)
	}
	if hits[0].Snippet == "" {
		t.Fatal("expected snippet")
	}
}

func TestChunkLessonContent(t *testing.T) {
	var long string
	for i := 0; i < 30; i++ {
		long += "这是第" + string(rune('一'+i%10)) + "段关于关系数据库与外键约束的说明。\n\n"
	}
	chunks := chunkLessonContent(long)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
}
