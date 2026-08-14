package edu_service

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type JSONMemoryStore struct {
	dir string
	mu  sync.Mutex
}

func NewJSONMemoryStore(dir string) (*JSONMemoryStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &JSONMemoryStore{dir: dir}, nil
}

func (s *JSONMemoryStore) Load(studentID string) (StudentMemory, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.path(studentID)
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return StudentMemory{
			KnowledgeWeakness:  []string{},
			CommonErrors:       []string{},
			ThinkingStyle:      "unknown",
			ReflectionLevel:    0,
			UnderstandingScore: 0,
			TrustScore:         0,
			UpdatedAt:          nowString(),
		}, nil
	}
	if err != nil {
		return StudentMemory{}, err
	}
	var memory StudentMemory
	if err := json.Unmarshal(data, &memory); err != nil {
		return StudentMemory{}, err
	}
	return memory, nil
}

func (s *JSONMemoryStore) Save(studentID string, memory StudentMemory) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	memory.UpdatedAt = nowString()
	data, err := json.MarshalIndent(memory, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path(studentID), data, 0644)
}

func (s *JSONMemoryStore) List() ([]StudentMemory, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	memories := make([]StudentMemory, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		if entry.Name() == "platform_state.json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, entry.Name()))
		if err != nil {
			return nil, err
		}
		var memory StudentMemory
		if err := json.Unmarshal(data, &memory); err != nil {
			return nil, err
		}
		if memory.UpdatedAt == "" && len(memory.KnowledgeWeakness)+len(memory.CommonErrors) == 0 && memory.ThinkingStyle == "" {
			continue
		}
		memories = append(memories, memory)
	}
	return memories, nil
}

func (s *JSONMemoryStore) path(studentID string) string {
	id := strings.TrimSpace(studentID)
	if id == "" {
		id = "anonymous"
	}
	id = strings.NewReplacer("/", "_", "\\", "_", ":", "_", "..", "_").Replace(id)
	return filepath.Join(s.dir, id+".json")
}
