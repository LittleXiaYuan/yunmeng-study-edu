package edu_service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type recordingKnowledgeAgent struct {
	callCount   int
	uploadCount int
	userInput   string
	response    string
	err         error
}

func (a *recordingKnowledgeAgent) Call(_ context.Context, _ string, userInput string) (string, error) {
	a.callCount++
	a.userInput = userInput
	return a.response, a.err
}

func (a *recordingKnowledgeAgent) UploadKnowledge(_ context.Context, _ AnalyzeRequest) (KnowledgeAnalysis, error) {
	a.uploadCount++
	return KnowledgeAnalysis{}, errors.New("legacy knowledge endpoint must not be called")
}

func TestTeacherAgentUsesValidatedChatPath(t *testing.T) {
	agent := &recordingKnowledgeAgent{
		response: `{"concepts":["事务"],"difficulties":["隔离级别"],"learning_path":["先理解原子性"]}`,
	}
	service := &Service{agent: agent}

	analysis := service.teacherAgent(context.Background(), AnalyzeRequest{Content: "数据库事务教案"})

	if agent.callCount != 1 {
		t.Fatalf("chat completion calls = %d, want 1", agent.callCount)
	}
	if agent.uploadCount != 0 {
		t.Fatalf("legacy knowledge upload calls = %d, want 0", agent.uploadCount)
	}
	if len(analysis.Concepts) != 1 || analysis.Concepts[0] != "事务" {
		t.Fatalf("unexpected analysis: %#v", analysis)
	}
}

func TestCompactKnowledgeAnalysisContentCapsAndSamplesLongDocument(t *testing.T) {
	head := strings.Repeat("甲", 20_000)
	middle := strings.Repeat("乙", 20_000)
	tail := strings.Repeat("丙", 20_000)

	compacted := compactKnowledgeAnalysisContent(head + middle + tail)
	compactedRunes := []rune(compacted)

	if len(compactedRunes) > maxKnowledgeAnalysisRunes {
		t.Fatalf("compacted content has %d runes, limit is %d", len(compactedRunes), maxKnowledgeAnalysisRunes)
	}
	if !strings.Contains(compacted, knowledgeAnalysisOmissionMarker) {
		t.Fatal("compacted content is missing the omission marker")
	}
	for _, sample := range []string{"甲甲甲", "乙乙乙", "丙丙丙"} {
		if !strings.Contains(compacted, sample) {
			t.Fatalf("compacted content is missing sample %q", sample)
		}
	}
}

func TestCompactKnowledgeAnalysisContentPreservesShortDocument(t *testing.T) {
	const content = "  一份较短的教案  "
	if got := compactKnowledgeAnalysisContent(content); got != strings.TrimSpace(content) {
		t.Fatalf("compactKnowledgeAnalysisContent() = %q", got)
	}
}
