"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { RetrievalHit } from "@/lib/types";
import { fieldCls, primaryBtnCls } from "../page-kit";

/**
 * RAG 检索试跑：教师/超管验证资料是否能被关键词检索到。
 * 与学生对话共用后端 SearchLessons（FTS5 或关键词回退）。
 */
export function RagSearchPanel() {
  const { dashboard } = useSession();
  const courses = useMemo(
    () => (dashboard?.courses ?? []).filter((c) => !c.archived),
    [dashboard],
  );

  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [indexed, setIndexed] = useState(0);
  const [terms, setTerms] = useState<string[]>([]);
  const [hits, setHits] = useState<RetrievalHit[]>([]);

  useEffect(() => {
    api
      .getRetrievalStats()
      .then((s) => {
        setStatus(s.status);
        setIndexed(s.indexed_count);
      })
      .catch(() => {
        setStatus("unknown");
      });
  }, []);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.searchLessons({
        query: q,
        courseId: courseId || undefined,
        limit: 6,
      });
      setHits(res.hits ?? []);
      setStatus(res.index_status);
      setIndexed(res.indexed_count);
      setTerms(res.terms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检索失败");
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    status === "sqlite-fts5"
      ? "SQLite FTS5 全文索引"
      : status === "json-index"
        ? "JSON 关键词索引"
        : status === "keyword-fallback"
          ? "关键词回退"
          : status === "no_match"
            ? "无匹配"
            : status || "—";

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Sparkles size={18} className="text-brand" />
            知识库引用试跑
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            导入后的教案会进入检索库；此处验证能否命中片段（与学生辅导共用）。索引：
            <strong className="text-foreground"> {statusLabel}</strong>
            <span className="mx-1.5 text-border">·</span>
            已入库 <strong className="tabular-nums">{indexed}</strong> 篇
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className={fieldCls + " flex-1"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          placeholder="例如：外键约束是什么"
        />
        <select
          className={fieldCls + " sm:w-44"}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">全部课程</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={primaryBtnCls + " shrink-0 gap-1.5"}
          disabled={busy || !query.trim()}
          onClick={runSearch}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          检索
        </button>
      </div>

      {terms.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          分词：
          {terms.map((t) => (
            <span
              key={t}
              className="mr-1.5 inline-block rounded-full bg-muted px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {hits.length === 0 && !busy && query && !error && (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            无命中。检查资料是否写入正文、是否归档，或换个说法再试。
          </p>
        )}
        {hits.map((h) => (
          <article
            key={`${h.lesson_id}-${h.score}`}
            className="rounded-2xl border border-brand/20 bg-gradient-to-br from-background to-brand-soft/20 px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                引用
              </span>
              <strong className="text-sm">{h.title}</strong>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand">
                相关度 {h.score}
              </span>
            </div>
            <p className="mt-2 border-l-2 border-brand/40 pl-3 text-sm leading-relaxed text-foreground/85">
              {h.snippet}
            </p>
            {h.concepts?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {h.concepts.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
