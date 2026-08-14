package edu_service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type AgentClient interface {
	Call(ctx context.Context, systemPrompt string, userInput string) (string, error)
	UploadKnowledge(ctx context.Context, req AnalyzeRequest) (KnowledgeAnalysis, error)
}

// StreamingAgentClient 是可选能力：支持增量输出的网关客户端实现它。
// Service 侧通过类型断言探测；不支持时回退整段 Call，保持 LLM-optional 不变。
type StreamingAgentClient interface {
	CallStream(ctx context.Context, systemPrompt string, userInput string, onDelta func(string)) (string, error)
}

type ConfigurableAgentClient interface {
	Configure(config LLMConfig)
	Config() LLMConfig
}

type YunqueClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
	mu      sync.RWMutex
}

func NewYunqueClient(baseURL string, apiKey string) *YunqueClient {
	return &YunqueClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		model:   "deepseek-v4-flash",
		client:  &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *YunqueClient) Configure(config LLMConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if config.BaseURL != "" {
		c.baseURL = strings.TrimRight(config.BaseURL, "/")
	}
	c.apiKey = config.APIKey
	if strings.TrimSpace(config.Model) != "" {
		c.model = strings.TrimSpace(config.Model)
	}
}

func (c *YunqueClient) Config() LLMConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return LLMConfig{BaseURL: c.baseURL, APIKey: c.apiKey, Model: c.model, Enabled: true}
}

func (c *YunqueClient) Call(ctx context.Context, systemPrompt string, userInput string) (string, error) {
	baseURL, apiKey, model := c.snapshot()
	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userInput},
		},
	}
	data, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("yunque call failed: %s %s", resp.Status, string(body))
	}
	return extractLLMText(body), nil
}

// CallStream 以 OpenAI 兼容 stream:true 方式调用网关，每收到一段增量文本就回调 onDelta，
// 最终返回完整拼接文本。网关若不按 SSE 返回（整块 JSON），会解析后一次性回调。
func (c *YunqueClient) CallStream(ctx context.Context, systemPrompt string, userInput string, onDelta func(string)) (string, error) {
	baseURL, apiKey, model := c.snapshot()
	payload := map[string]any{
		"model":  model,
		"stream": true,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userInput},
		},
	}
	data, _ := json.Marshal(payload)
	// 流式响应总时长可能超过普通调用的 20s，这里用独立超时（含生成全程）
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	// 不能复用 c.client：其 Timeout 覆盖整个响应体读取，会掐断长流
	streamHTTP := &http.Client{}
	resp, err := streamHTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("yunque stream call failed: %s %s", resp.Status, string(body))
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		// 网关不支持流式：按整块 JSON 解析并一次性回调
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", err
		}
		text := extractLLMText(body)
		if strings.TrimSpace(text) != "" && onDelta != nil {
			onDelta(text)
		}
		return text, nil
	}
	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		chunk := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if chunk == "" || chunk == "[DONE]" {
			continue
		}
		var event struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(chunk), &event) != nil || len(event.Choices) == 0 {
			continue
		}
		delta := event.Choices[0].Delta.Content
		if delta == "" {
			delta = event.Choices[0].Message.Content
		}
		if delta == "" {
			continue
		}
		full.WriteString(delta)
		if onDelta != nil {
			onDelta(delta)
		}
	}
	if err := scanner.Err(); err != nil && full.Len() == 0 {
		return "", err
	}
	return full.String(), nil
}

func (c *YunqueClient) UploadKnowledge(ctx context.Context, reqBody AnalyzeRequest) (KnowledgeAnalysis, error) {
	baseURL, apiKey, _ := c.snapshot()
	data, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/knowledge/upload", bytes.NewReader(data))
	if err != nil {
		return KnowledgeAnalysis{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return KnowledgeAnalysis{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return KnowledgeAnalysis{}, fmt.Errorf("knowledge upload failed: %s %s", resp.Status, string(body))
	}
	var out KnowledgeAnalysis
	if err := json.Unmarshal(body, &out); err == nil && len(out.Concepts)+len(out.Difficulties)+len(out.LearningPath) > 0 {
		return out, nil
	}
	var wrapped struct {
		Data KnowledgeAnalysis `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Data.Concepts)+len(wrapped.Data.Difficulties)+len(wrapped.Data.LearningPath) > 0 {
		return wrapped.Data, nil
	}
	return fallbackKnowledge(reqBody.Content), nil
}

func (c *YunqueClient) snapshot() (string, string, string) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	model := strings.TrimSpace(c.model)
	if model == "" {
		model = "deepseek-v4-flash"
	}
	return c.baseURL, c.apiKey, model
}

func extractLLMText(body []byte) string {
	var openAI struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &openAI) == nil && len(openAI.Choices) > 0 {
		return openAI.Choices[0].Message.Content
	}
	var simple struct {
		Content string `json:"content"`
		Text    string `json:"text"`
		Data    string `json:"data"`
	}
	if json.Unmarshal(body, &simple) == nil {
		switch {
		case simple.Content != "":
			return simple.Content
		case simple.Text != "":
			return simple.Text
		case simple.Data != "":
			return simple.Data
		}
	}
	return string(body)
}
