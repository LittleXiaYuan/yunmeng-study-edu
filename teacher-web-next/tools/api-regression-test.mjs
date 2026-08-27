import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const apiSourcePath = fileURLToPath(new URL("../lib/api.ts", import.meta.url));
const source = readFileSync(apiSourcePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: apiSourcePath,
});

const compiledModule = { exports: {} };
const evaluate = new Function("module", "exports", "require", outputText);
evaluate(compiledModule, compiledModule.exports, () => {
  throw new Error("api.ts unexpectedly emitted a runtime import");
});
const api = compiledModule.exports;

const originals = {
  fetch: globalThis.fetch,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

let scheduledTimeout = null;
globalThis.setTimeout = (_callback, timeoutMs) => {
  scheduledTimeout = timeoutMs;
  return 1;
};
globalThis.clearTimeout = () => {};

try {
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({ total: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const report = await api.uploadMaterials([], "测试教案");
  assert.equal(report.total, 1);
  assert.equal(
    scheduledTimeout,
    120_000,
    "upload must not inherit the 8s timeout"
  );
  assert.match(capturedRequest.url, /\/edu\/lessons\/upload$/);
  assert.equal(capturedRequest.init.method, "POST");
  assert.ok(capturedRequest.init.body instanceof FormData);

  globalThis.fetch = async () =>
    new Response("upstream plain-text failure", { status: 502 });
  await assert.rejects(
    () => api.apiFetch("/plain-error"),
    (error) =>
      error instanceof Error && error.message === "upstream plain-text failure",
    "a non-JSON error body must be read once and preserve the original message"
  );

  globalThis.fetch = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  await assert.rejects(
    () => api.apiFetch("/slow"),
    (error) =>
      error instanceof api.RequestTimeoutError &&
      !error.message.includes("后端是否可达") &&
      error.timeoutMs === 8_000,
    "timeouts must use the typed, non-misleading error"
  );
} finally {
  globalThis.fetch = originals.fetch;
  globalThis.setTimeout = originals.setTimeout;
  globalThis.clearTimeout = originals.clearTimeout;
}

console.log("api regression tests passed");
