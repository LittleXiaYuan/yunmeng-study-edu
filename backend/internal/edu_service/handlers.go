package edu_service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

func RegisterHandlers(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("POST /auth/login", func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.Login(req)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /auth/me", func(w http.ResponseWriter, r *http.Request) {
		user, ok := service.UserByToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			return
		}
		writeJSON(w, http.StatusOK, user)
	})

	mux.HandleFunc("GET /users", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		query := parseListQueryFromRequest(r)
		users, err := service.ListUsersPage(query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, users)
	})

	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		users, err := service.ListUsers()
		if err != nil {
			writeError(w, err)
			return
		}
		id := r.PathValue("id")
		for _, user := range users {
			if user.ID == id {
				writeJSON(w, http.StatusOK, user)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
	})

	mux.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
		var req CreateUserRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateUser(r.Context(), req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /users/update", func(w http.ResponseWriter, r *http.Request) {
		var req UpdateUserRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.UpdateUser(r.Context(), req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/users/{id}/avatar", func(w http.ResponseWriter, r *http.Request) {
		handleUserImageUpload(w, r, service, "avatar")
	})

	mux.HandleFunc("POST /edu/users/{id}/background", func(w http.ResponseWriter, r *http.Request) {
		handleUserImageUpload(w, r, service, "background")
	})

	mux.HandleFunc("POST /edu/analyze", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req AnalyzeRequest
		if !decode(w, r, &req) {
			return
		}
		writeJSON(w, http.StatusOK, service.Analyze(r.Context(), req))
	})

	mux.HandleFunc("GET /edu/dashboard", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.DashboardFor(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/classes", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListClassesPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// —— 学校/组织管理（仅 admin）——
	mux.HandleFunc("GET /edu/schools", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		query := parseListQueryFromRequest(r)
		resp, err := service.ListSchoolsPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/schools", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateSchoolRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateSchool(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/classes/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.ClassByID(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/courses", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListCoursesPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/courses/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.CourseByID(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/students", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListStudentsPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/students/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.StudentDetail(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/lessons", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListLessonsPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/lessons/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.LessonByID(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/homework", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListHomeworksPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/homework/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.HomeworkByID(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/homework/{id}/attempts", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.HomeworkAttempts(r.Context(), r.PathValue("id"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": resp, "total": len(resp)})
	})

	mux.HandleFunc("POST /edu/homework/{id}/attempts/reset", func(w http.ResponseWriter, r *http.Request) {
		var req ResetHomeworkAttemptsRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.ResetHomeworkAttempts(r.Context(), r.PathValue("id"), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/sessions", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListSessionsPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.SessionByID(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/audit", func(w http.ResponseWriter, r *http.Request) {
		query := parseListQueryFromRequest(r)
		resp, err := service.ListAuditLogsPage(r.Context(), query)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/classes", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateClassRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateClass(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/students", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateStudentRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateStudent(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// 批量导入学生（对话 Agent 也会调用）：逐行创建，单行失败不中断整批。
	mux.HandleFunc("POST /edu/students/import", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req ImportStudentsRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.ImportStudents(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/courses", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateCourseRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateCourse(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/lessons", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateLessonRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateLesson(r.Context(), req, "")
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// 更新教案：路径 id 优先；同 CreateLesson 的 upsert 语义（可改标题/正文/课程/归档）
	mux.HandleFunc("PUT /edu/lessons/{id}", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateLessonRequest
		if !decode(w, r, &req) {
			return
		}
		req.ID = r.PathValue("id")
		resp, err := service.CreateLesson(r.Context(), req, "")
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
	mux.HandleFunc("POST /edu/lessons/upload", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if err := r.ParseMultipartForm(80 << 20); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		headers := r.MultipartForm.File["files"]
		if len(headers) == 0 {
			headers = r.MultipartForm.File["file"]
		}
		pasteContent := strings.TrimSpace(r.FormValue("content"))
		if pasteContent == "" {
			pasteContent = strings.TrimSpace(r.FormValue("text"))
		}
		if len(headers) == 0 && pasteContent == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请上传文件或粘贴文本"})
			return
		}

		lessons := make([]Lesson, 0)
		importedRecords := []LessonImportRecord{}
		skipped := []LessonImportSkip{}
		kindBag := []string{}

		processItem := func(fileName, title, content string, multi bool) error {
			kind, conf, reason := classifyImportedContent(fileName, title, content)
			kindBag = append(kindBag, kind)
			if kind == ImportKindNoise {
				skipped = append(skipped, LessonImportSkip{
					FileName:   fileName,
					Reason:     reason,
					Kind:       kind,
					KindLabel:  kindLabelZH(kind),
					Confidence: conf,
				})
				return nil
			}
			id := r.FormValue("id")
			if multi {
				id = ""
			}
			resp, err := service.CreateLesson(r.Context(), CreateLessonRequest{
				ID:       id,
				CourseID: r.FormValue("course_id"),
				Title:    title,
				Content:  content,
			}, fileName)
			if err != nil {
				return err
			}
			lessons = append(lessons, resp)
			importedRecords = append(importedRecords, LessonImportRecord{
				FileName:      fileName,
				Title:         title,
				LessonID:      resp.ID,
				ContentLength: len([]rune(content)),
				Kind:          kind,
				KindLabel:     kindLabelZH(kind),
				Confidence:    conf,
				Reason:        reason,
				Concepts:      limitStrings(resp.Analysis.Concepts, 6),
			})
			return nil
		}

		for _, header := range headers {
			file, err := header.Open()
			if err != nil {
				writeError(w, err)
				return
			}
			data, err := io.ReadAll(io.LimitReader(file, 80<<20))
			_ = file.Close()
			if err != nil {
				writeError(w, err)
				return
			}
			importResult, err := ImportLessonBundle(header.Filename, data, pasteContent)
			for _, s := range importResult.Skipped {
				kindBag = append(kindBag, ImportKindNoise)
				if s.Kind == "" {
					s.Kind = ImportKindNoise
					s.KindLabel = kindLabelZH(ImportKindNoise)
				}
				skipped = append(skipped, s)
			}
			if err != nil {
				if len(headers) == 1 && len(importResult.Files) == 0 {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
					return
				}
				skipped = append(skipped, LessonImportSkip{
					FileName:  header.Filename,
					Reason:    err.Error(),
					Kind:      ImportKindNoise,
					KindLabel: kindLabelZH(ImportKindNoise),
				})
				continue
			}
			multi := len(headers) > 1 || len(importResult.Files) > 1
			for _, item := range importResult.Files {
				title := strings.TrimSpace(r.FormValue("title"))
				if title == "" || multi {
					title = item.Title
				}
				if err := processItem(item.FileName, title, item.Content, multi); err != nil {
					writeError(w, err)
					return
				}
			}
		}

		if len(headers) == 0 && pasteContent != "" {
			title := strings.TrimSpace(r.FormValue("title"))
			if title == "" {
				title = "粘贴导入的教案"
			}
			if err := processItem("paste.txt", title, pasteContent, false); err != nil {
				writeError(w, err)
				return
			}
		}

		intentCode, intentLabel, intentSummary := summarizeImportIntent(kindBag)
		resp := LessonUploadResponse{
			Items:    lessons,
			Imported: importedRecords,
			Skipped:  skipped,
			Total:    len(lessons),
			Message:  intentSummary,
			Intent: &ImportIntentSummary{
				Intent:  intentCode,
				Label:   intentLabel,
				Summary: intentSummary,
			},
		}
		resp.Stats.Accepted = len(importedRecords)
		resp.Stats.Skipped = len(skipped)
		for _, rec := range importedRecords {
			switch rec.Kind {
			case ImportKindLesson:
				resp.Stats.Lessons++
			case ImportKindHomework:
				resp.Stats.Homework++
			}
		}
		for _, s := range skipped {
			if s.Kind == ImportKindNoise || s.Kind == "" {
				resp.Stats.Noise++
			}
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/homework", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CreateHomeworkRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.CreateHomework(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/homework/auto", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req AutoHomeworkRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.AutoCreateHomework(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/homework/submit", func(w http.ResponseWriter, r *http.Request) {
		var req SubmitHomeworkRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.SubmitHomework(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/agent/write", func(w http.ResponseWriter, r *http.Request) {
		var req AgentWriteRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.AgentWrite(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /edu/llm/config", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.LLMConfig(r.Context())
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/llm/config", func(w http.ResponseWriter, r *http.Request) {
		var req LLMConfig
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.UpdateLLMConfig(r.Context(), req)
		if err != nil {
			var testErr *LLMConfigTestError
			if errors.As(err, &testErr) {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
					"code":  testErr.Code,
					"error": testErr.Error(),
				})
				return
			}
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/llm/test", func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.AgentChat(r.Context(), AgentChatRequest{
			Mode:    "teacher",
			Message: "请用一句话确认云雀 /v1 接口已经可用于《数据库原理》AI 教学系统。",
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/agent/chat", func(w http.ResponseWriter, r *http.Request) {
		var req AgentChatRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.AgentChat(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/agent/command", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req AgentCommandRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.AgentCommand(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// —— 对话历史 CRUD（按登录用户归属隔离）——

	mux.HandleFunc("GET /edu/conversations", func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListConversations(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		// 列表返回精简摘要（不含 messages），减小载荷。
		summaries := make([]map[string]any, 0, len(items))
		for _, c := range items {
			summaries = append(summaries, map[string]any{
				"id":            c.ID,
				"title":         c.Title,
				"mode":          c.Mode,
				"message_count": len(c.Messages),
				"updated_at":    c.UpdatedAt,
				"created_at":    c.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": summaries})
	})

	mux.HandleFunc("GET /edu/conversations/{id}", func(w http.ResponseWriter, r *http.Request) {
		conv, err := service.ConversationDetail(r.Context(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, conv)
	})

	mux.HandleFunc("POST /edu/conversations", func(w http.ResponseWriter, r *http.Request) {
		var req SaveConversationRequest
		if !decode(w, r, &req) {
			return
		}
		conv, err := service.SaveConversation(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, conv)
	})

	mux.HandleFunc("DELETE /edu/conversations/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.RemoveConversation(r.Context(), r.PathValue("id")); err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// RAG 检索试跑 + 索引状态（教师/超管）
	mux.HandleFunc("GET /edu/retrieval/stats", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		stats, err := service.platform.RetrievalStats()
		if err != nil {
			// 降级：从 dashboard 数未归档教案
			dash, dErr := service.DashboardFor(r.Context())
			if dErr != nil {
				writeError(w, err)
				return
			}
			n := 0
			for _, l := range dash.Lessons {
				if !l.Archived {
					n++
				}
			}
			writeJSON(w, http.StatusOK, RetrievalIndexStats{Status: "keyword-fallback", IndexedCount: n})
			return
		}
		writeJSON(w, http.StatusOK, stats)
	})

	mux.HandleFunc("POST /edu/retrieval/search", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req SearchRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.Search(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/chat", func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.Chat(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// SSE 流式对话：event 依次为 delta*（{"content"}）→ done（完整 ChatResponse）。
	// 出错时：若未开始推流回普通 JSON 错误；已推流则补一个 error 事件。
	mux.HandleFunc("POST /edu/chat/stream", func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if !decode(w, r, &req) {
			return
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			// 传输层不支持 flush：退回整段返回，前端按普通 JSON 处理
			resp, err := service.Chat(r.Context(), req)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, resp)
			return
		}
		started := false
		send := func(event string, payload any) {
			if !started {
				h := w.Header()
				h.Set("Content-Type", "text/event-stream; charset=utf-8")
				h.Set("Cache-Control", "no-cache")
				h.Set("X-Accel-Buffering", "no")
				w.WriteHeader(http.StatusOK)
				started = true
			}
			data, _ := json.Marshal(payload)
			_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
			flusher.Flush()
		}
		resp, err := service.ChatStream(r.Context(), req, func(delta string) {
			send("delta", map[string]string{"content": delta})
		})
		if err != nil {
			if started {
				send("error", map[string]string{"error": err.Error()})
				return
			}
			writeError(w, err)
			return
		}
		send("done", resp)
	})

	mux.HandleFunc("POST /edu/evaluate", func(w http.ResponseWriter, r *http.Request) {
		var req EvaluateRequest
		if !decode(w, r, &req) {
			return
		}
		evaluation, memory, err := service.Evaluate(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"evaluation": evaluation, "memory": memory})
	})

	mux.HandleFunc("POST /edu/report", func(w http.ResponseWriter, r *http.Request) {
		var req ReportRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.Report(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /edu/workflow", func(w http.ResponseWriter, r *http.Request) {
		var req WorkflowRequest
		if !decode(w, r, &req) {
			return
		}
		resp, err := service.Workflow(r.Context(), req)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// POST /edu/code-review —— 第 5 个 Agent：代码审查
	// 三角色（admin / teacher / student）均可调用；学生走自己的 trust 上下文，
	// 审查结果会进 HomeworkAttempt 关联到分数（教师在班级报告里看 Top 问题）。
	mux.HandleFunc("POST /edu/code-review", func(w http.ResponseWriter, r *http.Request) {
		user, err := RequireRole(r.Context(), "admin", "teacher", "student")
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		var req CodeReviewRequest
		if !decode(w, r, &req) {
			return
		}
		result, err := service.CodeReview(r.Context(), req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		// 审计：学生提交代码审查也算一次写操作意图（记录到审计流）
		if user.Role == "student" {
			_ = service.platform.AppendAudit(user.ID, "code_review", req.Language,
				fmt.Sprintf("score=%d issues=%d llm=%s", result.Score, len(result.Issues), result.LLMStatus))
		}
		writeJSON(w, http.StatusOK, result)
	})

	// GET /edu/code-review/languages —— 列出已注册的语言（前端下拉用）
	mux.HandleFunc("GET /edu/code-review/languages", func(w http.ResponseWriter, r *http.Request) {
		if _, err := RequireRole(r.Context(), "admin", "teacher", "student"); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"languages": SupportedCodeLanguages()})
	})
}

func handleUserImageUpload(w http.ResponseWriter, r *http.Request, service *Service, kind string) {
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxUserImageBytes+1))
	if err != nil {
		writeError(w, err)
		return
	}
	resp, err := service.UploadUserImage(r.Context(), r.PathValue("id"), kind, data)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func parseListQueryFromRequest(r *http.Request) ListQuery {
	page := parseInt(r.URL.Query().Get("page"), 1)
	pageSize := parseInt(r.URL.Query().Get("page_size"), 20)
	archived := parseOptionalBool(r.URL.Query().Get("archived"))
	return parseListQuery(page, pageSize, r.URL.Query().Get("keyword"), r.URL.Query().Get("role"), r.URL.Query().Get("class_id"), archived)
}

func parseInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseOptionalBool(value string) *bool {
	value = strings.TrimSpace(strings.ToLower(value))
	switch value {
	case "true", "1", "yes":
		v := true
		return &v
	case "false", "0", "no":
		v := false
		return &v
	default:
		return nil
	}
}
