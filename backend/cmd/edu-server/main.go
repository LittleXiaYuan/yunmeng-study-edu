package main

import (
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"study-edu-system/internal/edu_service"
)

// Frontend static assets (built by scripts/build-desktop.ps1 into web/).
//
//go:embed all:web
var embeddedWeb embed.FS

func main() {
	// Load optional .env next to the executable (desktop distribution).
	loadDotEnv(filepath.Join(exeDir(), ".env"))
	loadDotEnv(".env") // also allow cwd for development

	addr := env("EDU_ADDR", ":18080")
	dataDir := resolveDataDir()
	yunqueBaseURL := env("YUNQUE_BASE_URL", "http://127.0.0.1:8080")
	yunqueAPIKey := os.Getenv("YUNQUE_API_KEY")
	apiToken := os.Getenv("EDU_API_TOKEN")
	openBrowserFlag := env("EDU_OPEN_BROWSER", "1") != "0"
	allowedOrigins := splitList(env("EDU_ALLOWED_ORIGINS", strings.Join([]string{
		"http://127.0.0.1:3004", "http://localhost:3004",
		// teacher-web-next dev
		"http://127.0.0.1:3000", "http://localhost:3000",
		"http://127.0.0.1:3001", "http://localhost:3001",
		// docker / static nginx
		"http://127.0.0.1:18081", "http://localhost:18081",
		// desktop embedded / same-origin
		"http://127.0.0.1:18080", "http://localhost:18080",
	}, ",")))

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatalf("create data dir: %v", err)
	}

	store, err := edu_service.NewJSONMemoryStore(dataDir)
	if err != nil {
		log.Fatalf("init memory store: %v", err)
	}

	// Desktop package defaults to sqlite (single-file, portable).
	storageDriver := strings.ToLower(env("EDU_STORAGE_DRIVER", "sqlite"))
	var platformStore edu_service.PlatformDataStore
	if storageDriver == "sqlite" {
		sqlitePath := env("EDU_SQLITE_PATH", filepath.Join(dataDir, "study.db"))
		platformStore, err = edu_service.NewSQLitePlatformStore(sqlitePath, dataDir)
	} else {
		platformStore, err = edu_service.NewPlatformStore(dataDir)
	}
	if err != nil {
		log.Fatalf("init %s platform store: %v", storageDriver, err)
	}

	agentClient := edu_service.NewYunqueClient(yunqueBaseURL, yunqueAPIKey)
	if config, err := platformStore.LLMConfig(); err == nil && config.BaseURL != "" {
		agentClient.Configure(config)
	}
	service := edu_service.NewService(store, platformStore, agentClient, dataDir)
	mux := http.NewServeMux()
	edu_service.RegisterHandlers(mux, service)
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(filepath.Join(dataDir, "uploads")))))

	webRoot, err := fs.Sub(embeddedWeb, "web")
	if err != nil {
		log.Fatalf("embed web assets: %v", err)
	}
	// Auth only on API routes; SPA static assets stay public (login page / JS / CSS).
	apiHandler := service.AuthMiddleware(mux)
	handler := withSPA(apiHandler, webRoot)

	publicURL := publicURLFromAddr(addr)
	log.Printf("edu server listening on %s (%s storage)", addr, storageDriver)
	log.Printf("open in browser: %s", publicURL)
	log.Printf("data directory: %s", dataDir)
	log.Printf("default accounts: admin/admin123456  teacher/teacher123456  student001/student123456")
	log.Printf("LLM: configure in Admin UI (设置) or set YUNQUE_BASE_URL / YUNQUE_API_KEY in .env")

	if openBrowserFlag {
		go func() {
			time.Sleep(400 * time.Millisecond)
			_ = openBrowser(publicURL)
		}()
	}

	log.Fatal(http.ListenAndServe(addr, withCORS(withAuth(handler, apiToken), allowedOrigins)))
}

// withSPA serves the embedded frontend (Next.js static export under web/).
// Resolves Next out/ layouts: path, path.html, path/index.html; falls back to /.
func withSPA(api http.Handler, web fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(web))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAPIPath(r.URL.Path) {
			api.ServeHTTP(w, r)
			return
		}
		// Only serve SPA/static for safe methods.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			api.ServeHTTP(w, r)
			return
		}
		if resolved, ok := resolveStaticPath(web, r.URL.Path); ok {
			serveEmbedded(fileServer, w, r, resolved)
			return
		}
		// Client-side routes / missing assets: fall back to app shell.
		serveEmbedded(fileServer, w, r, "index.html")
	})
}

// resolveStaticPath maps a URL path to a file inside the Next static export.
// Handles: "", "admin", "admin/", "admin.html", "_next/static/...", assets.
func resolveStaticPath(web fs.FS, urlPath string) (string, bool) {
	path := strings.TrimPrefix(urlPath, "/")
	path = strings.TrimSuffix(path, "/")
	if path == "" {
		if fsFileExists(web, "index.html") {
			return "index.html", true
		}
		return "", false
	}
	// Prefer explicit HTML shells over directories (Next export: admin.html or admin/index.html).
	candidates := []string{
		path + ".html",
		path + "/index.html",
		path,
	}
	for _, c := range candidates {
		if fsFileExists(web, c) {
			return c, true
		}
	}
	return "", false
}

func fsFileExists(web fs.FS, path string) bool {
	f, err := web.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func serveEmbedded(fileServer http.Handler, w http.ResponseWriter, r *http.Request, resolved string) {
	r2 := r.Clone(r.Context())
	// http.FileServer expects a URL path; map index.html to "/".
	if resolved == "index.html" {
		r2.URL.Path = "/"
	} else {
		r2.URL.Path = "/" + resolved
	}
	fileServer.ServeHTTP(w, r2)
}

func isAPIPath(p string) bool {
	if p == "/healthz" {
		return true
	}
	return strings.HasPrefix(p, "/auth") ||
		strings.HasPrefix(p, "/users") ||
		strings.HasPrefix(p, "/edu") ||
		strings.HasPrefix(p, "/uploads")
}

func resolveDataDir() string {
	if v := os.Getenv("EDU_DATA_DIR"); v != "" {
		return v
	}
	// Portable: store data next to the .exe (not next to a temp go-run binary).
	dir := exeDir()
	if dir != "" && !isEphemeralDir(dir) {
		return filepath.Join(dir, "data")
	}
	return "data"
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err == nil {
		exe = resolved
	}
	return filepath.Dir(exe)
}

func isEphemeralDir(dir string) bool {
	lower := strings.ToLower(dir)
	temp := strings.ToLower(os.TempDir())
	if temp != "" && strings.HasPrefix(lower, temp) {
		return true
	}
	// go run / go test cache paths
	return strings.Contains(lower, string(filepath.Separator)+"go-build") ||
		strings.Contains(lower, string(filepath.Separator)+"go-test")
}

func publicURLFromAddr(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		// addr may be ":18080"
		if strings.HasPrefix(addr, ":") {
			return "http://127.0.0.1" + addr
		}
		return "http://127.0.0.1:18080"
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("cmd", "/c", "start", "", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

// loadDotEnv reads KEY=VALUE lines into the process environment (does not override existing env).
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		if key == "" {
			continue
		}
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

func env(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func withCORS(next http.Handler, allowedOrigins []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && contains(allowedOrigins, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func splitList(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func contains(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func withAuth(next http.Handler, token string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token == "" || r.Method == http.MethodOptions || r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		// Static SPA assets must remain public (login page).
		if !isAPIPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
