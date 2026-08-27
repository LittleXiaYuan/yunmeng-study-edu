package edu_service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

type receivedLLMConfigTestRequest struct {
	Path          string
	Authorization string
	Model         string
	Message       string
}

func TestYunqueClientTestConfigSendsHelloWithCandidateCredentials(t *testing.T) {
	received := make(chan receivedLLMConfigTestRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		message := ""
		if len(payload.Messages) > 0 {
			message = payload.Messages[0].Content
		}
		received <- receivedLLMConfigTestRequest{
			Path:          r.URL.Path,
			Authorization: r.Header.Get("Authorization"),
			Model:         payload.Model,
			Message:       message,
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"你好！"}}]}`))
	}))
	defer server.Close()

	client := NewYunqueClient("https://active.example", "active-key")
	err := client.TestConfig(context.Background(), LLMConfig{
		BaseURL: server.URL,
		APIKey:  "candidate-key",
		Model:   "candidate-model",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("TestConfig returned error: %v", err)
	}

	request := <-received
	if request.Path != "/v1/chat/completions" {
		t.Errorf("path = %q, want /v1/chat/completions", request.Path)
	}
	if request.Authorization != "Bearer candidate-key" {
		t.Errorf("authorization = %q, want candidate credentials", request.Authorization)
	}
	if request.Model != "candidate-model" {
		t.Errorf("model = %q, want candidate-model", request.Model)
	}
	if request.Message != "你好" {
		t.Errorf("message = %q, want 你好", request.Message)
	}

	active := client.Config()
	if active.BaseURL != "https://active.example" || active.APIKey != "active-key" {
		t.Fatalf("candidate test changed active config: %#v", active)
	}
}

func TestYunqueClientTestConfigClassifiesAPIKeyAndEndpointErrors(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		body     string
		wantCode string
	}{
		{
			name:     "invalid api key",
			status:   http.StatusUnauthorized,
			body:     `{"error":{"code":"invalid_api_key","message":"Incorrect API key"}}`,
			wantCode: LLMConfigErrorAPIKey,
		},
		{
			name:     "wrong endpoint or model",
			status:   http.StatusNotFound,
			body:     `{"error":{"message":"not found"}}`,
			wantCode: LLMConfigErrorEndpoint,
		},
		{
			name:     "malformed success response",
			status:   http.StatusOK,
			body:     `{"status":"ok"}`,
			wantCode: LLMConfigErrorEndpoint,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			client := NewYunqueClient("", "")
			err := client.TestConfig(context.Background(), LLMConfig{
				BaseURL: server.URL,
				APIKey:  "candidate-key",
				Model:   "candidate-model",
				Enabled: true,
			})
			var testErr *LLMConfigTestError
			if !errors.As(err, &testErr) {
				t.Fatalf("error = %v, want *LLMConfigTestError", err)
			}
			if testErr.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", testErr.Code, tt.wantCode)
			}
		})
	}
}

func TestYunqueClientTestConfigClassifiesConnectionFailureAsEndpointError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	baseURL := server.URL
	server.Close()

	client := NewYunqueClient("", "")
	err := client.TestConfig(context.Background(), LLMConfig{
		BaseURL: baseURL,
		APIKey:  "candidate-key",
		Model:   "candidate-model",
		Enabled: true,
	})
	var testErr *LLMConfigTestError
	if !errors.As(err, &testErr) {
		t.Fatalf("error = %v, want *LLMConfigTestError", err)
	}
	if testErr.Code != LLMConfigErrorEndpoint {
		t.Errorf("code = %q, want %q", testErr.Code, LLMConfigErrorEndpoint)
	}
}

func TestUpdateLLMConfigFailureKeepsPersistedAndRuntimeConfig(t *testing.T) {
	service, platform, client := newLLMConfigValidationService(t)
	initial := LLMConfig{
		BaseURL: "https://working.example",
		APIKey:  "working-key",
		Model:   "working-model",
		Enabled: true,
	}
	if _, err := platform.UpdateLLMConfig(initial, "test-setup"); err != nil {
		t.Fatalf("save initial config: %v", err)
	}
	client.Configure(initial)
	stateBefore, err := platform.State()
	if err != nil {
		t.Fatalf("state before: %v", err)
	}

	rejectingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"code":"invalid_api_key"}}`))
	}))
	defer rejectingServer.Close()

	_, err = service.UpdateLLMConfig(userContext(User{ID: "admin_test", Role: "admin", Active: true}), LLMConfig{
		BaseURL: rejectingServer.URL,
		APIKey:  "wrong-key",
		Model:   "new-model",
		Enabled: true,
	})
	var testErr *LLMConfigTestError
	if !errors.As(err, &testErr) || testErr.Code != LLMConfigErrorAPIKey {
		t.Fatalf("error = %v, want API key validation error", err)
	}

	persisted, err := platform.LLMConfig()
	if err != nil {
		t.Fatalf("load persisted config: %v", err)
	}
	assertSameLLMConfig(t, persisted, initial)
	assertSameLLMConfig(t, client.Config(), initial)
	stateAfter, err := platform.State()
	if err != nil {
		t.Fatalf("state after: %v", err)
	}
	if len(stateAfter.Audit) != len(stateBefore.Audit) {
		t.Errorf("failed validation appended audit entry: before=%d after=%d", len(stateBefore.Audit), len(stateAfter.Audit))
	}
}

func TestUpdateLLMConfigUsesSavedKeyThenPersistsOnlyAfterSuccess(t *testing.T) {
	service, platform, client := newLLMConfigValidationService(t)
	initial := LLMConfig{
		BaseURL: "https://old.example",
		APIKey:  "saved-key",
		Model:   "old-model",
		Enabled: true,
	}
	if _, err := platform.UpdateLLMConfig(initial, "test-setup"); err != nil {
		t.Fatalf("save initial config: %v", err)
	}
	client.Configure(initial)

	received := make(chan receivedLLMConfigTestRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		message := ""
		if len(payload.Messages) > 0 {
			message = payload.Messages[0].Content
		}
		received <- receivedLLMConfigTestRequest{
			Authorization: r.Header.Get("Authorization"),
			Message:       message,
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"你好"}}]}`))
	}))
	defer server.Close()

	saved, err := service.UpdateLLMConfig(userContext(User{ID: "admin_test", Role: "admin", Active: true}), LLMConfig{
		BaseURL: server.URL,
		APIKey:  "********",
		Model:   "new-model",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("UpdateLLMConfig returned error: %v", err)
	}
	request := <-received
	if request.Authorization != "Bearer saved-key" || request.Message != "你好" {
		t.Fatalf("candidate request did not use saved key / hello: %#v", request)
	}
	if saved.APIKey != "********" {
		t.Errorf("returned API key was not masked: %q", saved.APIKey)
	}

	persisted, err := platform.LLMConfig()
	if err != nil {
		t.Fatalf("load persisted config: %v", err)
	}
	want := LLMConfig{BaseURL: server.URL, APIKey: "saved-key", Model: "new-model", Enabled: true}
	assertSameLLMConfig(t, persisted, want)
	assertSameLLMConfig(t, client.Config(), want)
}

func TestUpdateLLMConfigSkipsConnectionTestWhenDisabling(t *testing.T) {
	service, platform, _ := newLLMConfigValidationService(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	_, err := service.UpdateLLMConfig(userContext(User{ID: "admin_test", Role: "admin", Active: true}), LLMConfig{
		BaseURL: server.URL,
		Model:   "offline-model",
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("disable config: %v", err)
	}
	if calls.Load() != 0 {
		t.Errorf("disabled config performed %d connection tests", calls.Load())
	}
	persisted, err := platform.LLMConfig()
	if err != nil {
		t.Fatalf("load disabled config: %v", err)
	}
	if persisted.Enabled {
		t.Fatal("disabled config was not persisted")
	}
}

func TestLLMConfigHandlerReturnsSafeClassifiedError(t *testing.T) {
	service, _, _ := newLLMConfigValidationService(t)
	rejectingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"Incorrect API key"}}`))
	}))
	defer rejectingServer.Close()

	mux := http.NewServeMux()
	RegisterHandlers(mux, service)
	body := `{"base_url":"` + rejectingServer.URL + `","api_key":"wrong-key","model":"test-model","enabled":true}`
	req := httptest.NewRequest(http.MethodPost, "/edu/llm/config", strings.NewReader(body))
	req = req.WithContext(userContext(User{ID: "admin_test", Role: "admin", Active: true}))
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusUnprocessableEntity, recorder.Body.String())
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response["code"] != LLMConfigErrorAPIKey {
		t.Errorf("code = %q, want %q", response["code"], LLMConfigErrorAPIKey)
	}
	if response["error"] != "API 密钥错误，请检查后重新保存" {
		t.Errorf("error = %q", response["error"])
	}
	if strings.Contains(recorder.Body.String(), "wrong-key") {
		t.Fatal("response leaked candidate API key")
	}
}

func newLLMConfigValidationService(t *testing.T) (*Service, *PlatformStore, *YunqueClient) {
	t.Helper()
	dir := t.TempDir()
	memory, err := NewJSONMemoryStore(dir)
	if err != nil {
		t.Fatalf("memory store: %v", err)
	}
	platform, err := NewPlatformStore(dir)
	if err != nil {
		t.Fatalf("platform store: %v", err)
	}
	client := NewYunqueClient("https://active.example", "active-key")
	return NewService(memory, platform, client, dir), platform, client
}

func assertSameLLMConfig(t *testing.T, got LLMConfig, want LLMConfig) {
	t.Helper()
	if got.BaseURL != want.BaseURL || got.APIKey != want.APIKey || got.Model != want.Model || got.Enabled != want.Enabled {
		t.Errorf("config = %#v, want base_url=%q api_key=<redacted> model=%q enabled=%t", got, want.BaseURL, want.Model, want.Enabled)
	}
}
