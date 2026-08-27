package edu_service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	LLMConfigErrorAPIKey   = "llm_api_key_invalid"
	LLMConfigErrorEndpoint = "llm_endpoint_error"

	llmConfigTestTimeout = 15 * time.Second
)

// LLMConfigTestError is safe to return to the browser: it deliberately keeps
// upstream response bodies and credentials out of Error().
type LLMConfigTestError struct {
	Code  string
	cause error
}

func (e *LLMConfigTestError) Error() string {
	if e != nil && e.Code == LLMConfigErrorAPIKey {
		return "API 密钥错误，请检查后重新保存"
	}
	return "LLM 接口错误，请检查接口地址、网络连接和模型 ID"
}

func (e *LLMConfigTestError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}

func newLLMConfigTestError(code string, cause error) error {
	return &LLMConfigTestError{Code: code, cause: cause}
}

// prepareLLMConfigCandidate resolves masked/empty values against the currently
// saved config. It does not mutate either input.
func prepareLLMConfigCandidate(config LLMConfig, current LLMConfig) (LLMConfig, error) {
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	if config.BaseURL == "" {
		return LLMConfig{}, newLLMConfigTestError(LLMConfigErrorEndpoint, fmt.Errorf("base_url is required"))
	}
	parsed, err := url.Parse(config.BaseURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return LLMConfig{}, newLLMConfigTestError(LLMConfigErrorEndpoint, fmt.Errorf("invalid base_url"))
	}

	config.Model = strings.TrimSpace(config.Model)
	if config.Model == "" {
		config.Model = strings.TrimSpace(current.Model)
	}
	if config.Model == "" {
		config.Model = "deepseek-v4-flash"
	}

	config.APIKey = strings.TrimSpace(config.APIKey)
	if config.APIKey == "" || strings.Contains(config.APIKey, "*") {
		config.APIKey = strings.TrimSpace(current.APIKey)
	}
	if config.Enabled && config.APIKey == "" {
		return LLMConfig{}, newLLMConfigTestError(LLMConfigErrorAPIKey, fmt.Errorf("api_key is required"))
	}
	config.UpdatedAt = ""
	return config, nil
}

// TestConfig sends a minimal non-streaming OpenAI-compatible request using the
// candidate config. It never calls Configure, so a failed test cannot disturb
// the active runtime configuration.
func (c *YunqueClient) TestConfig(ctx context.Context, config LLMConfig) error {
	payload := map[string]any{
		"model": config.Model,
		"messages": []map[string]string{
			{"role": "user", "content": "你好"},
		},
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, err)
	}

	testCtx, cancel := context.WithTimeout(ctx, llmConfigTestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(testCtx, http.MethodPost, config.BaseURL+"/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	httpClient := c.client
	if httpClient == nil {
		httpClient = &http.Client{Timeout: llmConfigTestTimeout}
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, err)
	}
	defer resp.Body.Close()
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if readErr != nil {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, readErr)
	}
	if isAPIKeyRejection(resp.StatusCode, body) {
		return newLLMConfigTestError(LLMConfigErrorAPIKey, fmt.Errorf("upstream rejected authentication with HTTP %d", resp.StatusCode))
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, fmt.Errorf("upstream returned HTTP %d", resp.StatusCode))
	}

	var result struct {
		Choices []json.RawMessage `json:"choices"`
	}
	if err := json.Unmarshal(body, &result); err != nil || len(result.Choices) == 0 {
		return newLLMConfigTestError(LLMConfigErrorEndpoint, fmt.Errorf("upstream returned an invalid chat completion response"))
	}
	return nil
}

func isAPIKeyRejection(status int, body []byte) bool {
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		return true
	}
	if status < http.StatusBadRequest {
		return false
	}
	lower := strings.ToLower(string(body))
	for _, marker := range []string{
		"invalid_api_key",
		"incorrect api key",
		"invalid api key",
		"api key is invalid",
		"authentication failed",
		"authentication_error",
		"unauthorized",
	} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}
