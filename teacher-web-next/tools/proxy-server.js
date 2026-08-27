#!/usr/bin/env node
// Single-port reverse proxy:
//   /api/*         -> http://127.0.0.1:18080 (Go backend)
//   *              -> static files from ./out (Next.js export)
//
// Used for the demo: cloudflared only needs to forward ONE port (3000),
// and visitors go through one URL.

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = parseInt(process.env.PORT || "3000", 10);
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:18080";
const OUT_DIR = path.resolve(__dirname, "..", "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function tryServeFile(req, res) {
  let pathname = decodeURIComponent(url.parse(req.url).pathname || "/");
  // Strip query
  pathname = pathname.split("?")[0];
  // 安全：拒绝 .. 路径穿越
  if (pathname.includes("..")) return false;
  // 静态文件直接读
  let filePath = path.join(OUT_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(filePath, res);
    return true;
  }
  // Next.js export 用 .html 扩展（如 /admin -> /admin.html）
  if (fs.existsSync(filePath + ".html")) {
    serveFile(filePath + ".html", res);
    return true;
  }
  // /admin -> out/admin/index.html
  const indexFile = path.join(filePath, "index.html");
  if (fs.existsSync(indexFile)) {
    serveFile(indexFile, res);
    return true;
  }
  // 兜底：根 index.html
  const rootIndex = path.join(OUT_DIR, "index.html");
  if (fs.existsSync(rootIndex)) {
    serveFile(rootIndex, res);
    return true;
  }
  return false;
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  // 公共缓存
  if (
    filePath.includes("/_next/static/") ||
    /\.(woff2?|ttf|ico|png|jpg|jpeg|webp|svg)$/.test(filePath)
  ) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Access-Control-Allow-Origin", "*");
  fs.createReadStream(filePath).pipe(res);
}

function proxyToBackend(req, res) {
  const target = new URL(BACKEND);
  const opts = {
    hostname: target.hostname,
    port: target.port,
    path: req.url.replace(/^\/api/, ""),
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host,
      // Hop-by-hop headers 去掉
      connection: "close",
    },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, {
      ...proxyRes.headers,
      "access-control-allow-origin": "*",
    });
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error(`[proxy error] ${req.method} ${req.url} -> ${err.message}`);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unreachable", detail: err.message }));
  });
  // 流式 body（SSE / 大请求）
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "*",
    });
    res.end();
    return;
  }
  // /api/* 与 /auth/* 与 /users/* 与 /edu/* 与 /healthz 全部代理到后端
  if (
    req.url.startsWith("/api/") ||
    req.url.startsWith("/auth/") ||
    req.url.startsWith("/users") ||
    req.url.startsWith("/edu/") ||
    req.url.startsWith("/llm") ||
    req.url === "/healthz"
  ) {
    return proxyToBackend(req, res);
  }
  // 其它走静态文件
  if (!tryServeFile(req, res)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] listening on http://0.0.0.0:${PORT}`);
  console.log(`[proxy] backend: ${BACKEND}`);
  console.log(`[proxy] static:  ${OUT_DIR}`);
  console.log(`[proxy] /api/*   -> ${BACKEND}`);
  console.log(`[proxy] /*       -> static files`);
});
