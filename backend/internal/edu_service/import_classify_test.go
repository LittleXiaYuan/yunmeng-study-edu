package edu_service

import "testing"

func TestClassifyImportedContent_Lesson(t *testing.T) {
	body := `第3章 关系模型
教学目标：理解关系、元组与属性。
重点：主键与外键约束。
难点：参照完整性。
学习路径：先掌握基本概念，再练习 SQL 建表。`
	kind, conf, reason := classifyImportedContent("第3章-关系模型教案.docx", "关系模型", body)
	if kind != ImportKindLesson {
		t.Fatalf("want lesson, got %s conf=%d reason=%s", kind, conf, reason)
	}
}

func TestClassifyImportedContent_NoiseRoster(t *testing.T) {
	body := `姓名 学号
张三 2026001
李四 2026002
王五 2026003
赵六 2026004
钱七 2026005
孙八 2026006
周九 2026007
吴十 2026008
郑一 2026009
王二 2026010`
	kind, _, reason := classifyImportedContent("班级名单.txt", "名单", body)
	if kind != ImportKindNoise {
		t.Fatalf("want noise, got %s reason=%s", kind, reason)
	}
}

func TestClassifyImportedContent_Homework(t *testing.T) {
	body := `作业一
请完成以下题目并提交。
1. 什么是主键？
2. 外键约束的作用是什么？
3. 请举例说明第三范式。
截止本周五，分值 20。`
	kind, _, _ := classifyImportedContent("第3章作业.docx", "练习", body)
	if kind != ImportKindHomework {
		t.Fatalf("want homework, got %s", kind)
	}
}

func TestSummarizeImportIntent(t *testing.T) {
	code, label, _ := summarizeImportIntent([]string{ImportKindLesson, ImportKindNoise})
	if code != ImportIntentIngestLessons {
		t.Fatalf("want ingest_lessons, got %s %s", code, label)
	}
}
