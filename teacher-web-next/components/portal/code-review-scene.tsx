"use client";

/**
 * 代码审查场景（学生端）
 * 第 5 个 Agent：CodeReviewAgent
 * - 粘贴代码 → 选语言 → 选填题目/Schema → 审查
 * - 反馈是「指出问题 + 苏格拉底式提示」，不直接给修正后代码
 * - 支持 SQL（含沙盒执行）和 Python（启发式，**不执行**）
 */

import { useEffect, useState } from "react";
import { ArrowLeft, Code2, Loader2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { codeReview, listCodeReviewLanguages } from "@/lib/api";
import type { CodeIssue, CodeReviewResult } from "@/lib/types";

const DEFAULT_SQL = `SELECT name
FROM students
WHERE class_id = 'c1'
ORDER BY id`;

const DEFAULT_PY = `def add(a, b):
    return a + b

result = add(1, 2)
print(result)`;

const SEVERITY_STYLES: Record<CodeIssue["severity"], { dot: string; tag: string; label: string }> = {
  error:   { dot: "bg-red-500",     tag: "bg-red-500/15 text-red-300 border-red-500/30",     label: "错误" },
  warning: { dot: "bg-amber-500",   tag: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "警告" },
  info:    { dot: "bg-sky-500",     tag: "bg-sky-500/15 text-sky-300 border-sky-500/30",     label: "建议" },
};

const TYPE_LABEL: Record<CodeIssue["type"], string> = {
  syntax: "语法",
  style: "风格",
  logic: "逻辑",
  performance: "性能",
  security: "安全",
  best_practice: "最佳实践",
};

export function CodeReviewScene({
  companion = false,
  onBack,
}: {
  companion?: boolean;
  onBack?: () => void;
} = {}) {
  const [language, setLanguage] = useState<string>("sql");
  const [languages, setLanguages] = useState<string[]>(["sql", "python"]);
  const [code, setCode] = useState<string>(DEFAULT_SQL);
  const [question, setQuestion] = useState<string>("");
  const [schema, setSchema] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载已注册语言列表
  useEffect(() => {
    listCodeReviewLanguages()
      .then(setLanguages)
      .catch(() => {/* 保留 fallback */});
  }, []);

  // 切换语言时给一份示例代码，避免空模板吓人
  useEffect(() => {
    if (code === DEFAULT_SQL || code === DEFAULT_PY) {
      setCode(language === "python" ? DEFAULT_PY : DEFAULT_SQL);
    }
    // 清掉旧结果，避免误导
    setResult(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await codeReview({
        code,
        language,
        question: question.trim() || undefined,
        schema: language === "sql" && schema.trim() ? schema : undefined,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const showSchema = language === "sql";
  const placeholder = showSchema
    ? "写 SQL：例如 SELECT name FROM students WHERE ..."
    : "写 Python：例如 def add(a, b):\n    return a + b";

  return (
    <div className="flex min-h-[70vh] flex-col">
      {companion && onBack ? (
        <div className="flex shrink-0 items-center gap-2 px-4 pt-3 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={16} />
            回到练习
          </button>
          <span className="text-[11px] text-muted-foreground">
            只指出问题 · 不直接给修正代码
          </span>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Code2 size={20} className="text-foreground/80" />
          <h1 className="text-xl font-semibold tracking-tight">代码审查</h1>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            启发式 + LLM 增强
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          把代码贴进来，让教练帮你检查语法 / 风格 / 安全 / 逻辑问题。
          反馈会按 <span className="text-foreground/80">信任分</span> 控制深度——
          自己先想一步，教练才会给得更多。
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 左：输入区 */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">语言</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {labelForLanguage(l)}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted-foreground">
                支持 {languages.length} 种：{languages.map(labelForLanguage).join(" / ")}
              </span>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={placeholder}
              spellCheck={false}
              className="h-64 w-full resize-y rounded-md border border-border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed focus:border-primary focus:outline-none"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                题目背景（可选）
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例如：查询选修了数据库课的学生"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </label>
              {showSchema ? (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  SQL Schema（可选，DDL）
                  <input
                    type="text"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    placeholder="CREATE TABLE students (id INT, name TEXT);"
                    className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] focus:border-primary focus:outline-none"
                  />
                </label>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || !code.trim()}
              className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              审查
            </button>
          </div>

          {/* 右：报告区 */}
          <div className="flex flex-col gap-3">
            {error ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <TriangleAlert size={14} />
                  审查失败
                </div>
                {error}
              </div>
            ) : null}

            {!result && !error ? (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                <Sparkles size={16} className="mr-2 inline-block" />
                贴上代码，点「审查」，结果会出现在这里
              </div>
            ) : null}

            {result ? <ReviewReport result={result} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewReport({ result }: { result: CodeReviewResult }) {
  const score = result.score;
  const scoreTone =
    score >= 80
      ? "text-emerald-300"
      : score >= 50
      ? "text-amber-300"
      : "text-red-300";

  return (
    <div className="flex flex-col gap-3">
      {/* 头部：分数 + 状态 */}
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <span className={`text-xl font-semibold ${scoreTone}`}>{score}</span>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">
              {labelForLanguage(result.language)} 审查报告
            </span>
            <span className="text-[10px] text-muted-foreground">
              语法 {result.syntax_ok ? "✓" : "✗"} ·{" "}
              {result.executed_ok ? "可执行 ✓" : result.static_check_ok ? "静态通过" : "不可执行"} ·{" "}
              {result.llm_status === "llm_enhanced" ? "AI 增强" : "启发式"}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">
            {result.summary}
          </p>
        </div>
      </div>

      {/* 苏格拉底式提示（不直接给修正） */}
      {result.suggestion ? (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-300">
            <Sparkles size={12} />
            教练提示
          </div>
          <p className="text-sm leading-relaxed text-foreground/85">
            {result.suggestion}
          </p>
        </div>
      ) : null}

      {/* 问题清单 */}
      {result.issues.length === 0 ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">
          ✓ 没有发现明显问题
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.issues.map((iss, i) => {
            const sty = SEVERITY_STYLES[iss.severity] ?? SEVERITY_STYLES.info;
            return (
              <li
                key={i}
                className="rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${sty.dot}`} />
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] ${sty.tag}`}
                  >
                    {sty.label}
                  </span>
                  <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {TYPE_LABEL[iss.type] ?? iss.type}
                  </span>
                  {iss.line > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      L{iss.line}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-foreground/90">{iss.message}</p>
                {iss.suggestion ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    → {iss.suggestion}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">
        审查于 {result.reviewed_at}
        {result.llm_status === "llm_enhanced" ? " · 已用 LLM 增强" : null}
        {result.llm_status === "llm_failed_fallback" ? " · LLM 不可用，已用启发式" : null}
      </p>
    </div>
  );
}

function labelForLanguage(l: string): string {
  switch (l) {
    case "sql":    return "SQL";
    case "python": return "Python";
    default:       return l;
  }
}
