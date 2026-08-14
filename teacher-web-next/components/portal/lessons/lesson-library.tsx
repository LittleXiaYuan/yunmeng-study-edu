"use client";

import {
  Archive,
  ArchiveRestore,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Search,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { Lesson } from "@/lib/types";
import { EmptyState, fieldCls, primaryBtnCls } from "../page-kit";
import type { OpenPanel } from "../panel-registry";

const PAGE_SIZE = 12;

/**
 * 资料库：可搜索分页列表 → 点开查看全文 / 编辑 / 归档。
 * 导入走 openPanel("materials-upload")，不再把只读三列表当主界面。
 */
export function LessonLibrary({
  openPanel,
}: {
  openPanel?: OpenPanel;
}) {
  const { dashboard, refresh } = useSession();
  const courses = useMemo(
    () => (dashboard?.courses ?? []).filter((c) => !c.archived),
    [dashboard],
  );
  const courseName = useCallback(
    (id: string) =>
      courses.find((c) => c.id === id)?.name || id || "未分课程",
    [courses],
  );

  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Lesson[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Lesson | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    setPage(1);
  }, [courseFilter, showArchived]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 优先 API 分页；失败则回退 dashboard 本地过滤
      try {
        const res = await api.listLessons({
          page,
          pageSize: PAGE_SIZE,
          keyword: debounced || undefined,
          archived: showArchived ? true : false,
        });
        let list = res.items ?? [];
        if (courseFilter) {
          list = list.filter((l) => l.course_id === courseFilter);
        }
        setItems(list);
        setTotal(courseFilter ? list.length : (res.total ?? list.length));
        setHasNext(courseFilter ? false : res.has_next);
        setHasPrev(courseFilter ? false : res.has_prev);
      } catch {
        let list = (dashboard?.lessons ?? []).filter((l) =>
          showArchived ? l.archived : !l.archived,
        );
        if (debounced) {
          const k = debounced.toLowerCase();
          list = list.filter(
            (l) =>
              l.title.toLowerCase().includes(k) ||
              (l.content || "").toLowerCase().includes(k) ||
              (l.file_name || "").toLowerCase().includes(k),
          );
        }
        if (courseFilter) {
          list = list.filter((l) => l.course_id === courseFilter);
        }
        list = list
          .slice()
          .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
        setTotal(list.length);
        const start = (page - 1) * PAGE_SIZE;
        setItems(list.slice(start, start + PAGE_SIZE));
        setHasNext(start + PAGE_SIZE < list.length);
        setHasPrev(page > 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, debounced, courseFilter, showArchived, dashboard]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setDetailLoading(true);
    setError("");
    try {
      try {
        const lesson = await api.getLesson(id);
        setDetail(lesson);
        setEditTitle(lesson.title);
        setEditContent(lesson.content || "");
        setEditCourseId(lesson.course_id);
      } catch {
        const local = (dashboard?.lessons ?? []).find((l) => l.id === id);
        if (!local) throw new Error("资料不存在");
        setDetail(local);
        setEditTitle(local.title);
        setEditContent(local.content || "");
        setEditCourseId(local.course_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载详情失败");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [dashboard]);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setEditing(false);
  }, []);

  async function saveEdit() {
    if (!detail || !editTitle.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateLesson(detail.id, {
        title: editTitle.trim(),
        content: editContent,
        course_id: editCourseId || detail.course_id,
      });
      setDetail(updated);
      setEditing(false);
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.archiveLesson(
        detail.id,
        !detail.archived,
        detail.course_id,
      );
      setDetail(updated);
      await refresh();
      await load();
      if (!showArchived && updated.archived) closeDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }

  // ── 详情 / 编辑面板 ──
  if (selectedId) {
    return (
      <div className="flex min-h-[420px] flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
          <button
            type="button"
            onClick={closeDetail}
            className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={16} />
            返回列表
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {editing ? "编辑资料" : detail?.title || "资料详情"}
            </p>
          </div>
          {detail && !editing && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                <Pencil size={14} />
                编辑
              </button>
              <button
                type="button"
                onClick={toggleArchive}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                {detail.archived ? (
                  <>
                    <ArchiveRestore size={14} />
                    恢复
                  </>
                ) : (
                  <>
                    <Archive size={14} />
                    归档
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {detailLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            加载中…
          </div>
        ) : editing ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                标题
              </span>
              <input
                className={fieldCls}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                所属课程
              </span>
              <select
                className={fieldCls}
                value={editCourseId}
                onChange={(e) => setEditCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {!courses.find((c) => c.id === editCourseId) && editCourseId && (
                  <option value={editCourseId}>{editCourseId}</option>
                )}
              </select>
            </label>
            <label className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                正文内容
              </span>
              <textarea
                className={fieldCls + " min-h-[280px] flex-1 resize-y font-mono text-xs leading-relaxed"}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                className={primaryBtnCls}
                disabled={saving || !editTitle.trim()}
                onClick={saveEdit}
              >
                {saving ? "保存中…" : "保存修改"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setEditTitle(detail.title);
                  setEditContent(detail.content || "");
                  setEditCourseId(detail.course_id);
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">
                {courseName(detail.course_id)}
              </span>
              {detail.file_name && (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {detail.file_name}
                </span>
              )}
              {detail.archived && (
                <span className="rounded-full bg-muted px-2.5 py-1">已归档</span>
              )}
              {detail.updated_at && (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  更新 {new Date(detail.updated_at).toLocaleString("zh-CN")}
                </span>
              )}
            </div>

            {(detail.analysis?.concepts?.length ||
              detail.analysis?.difficulties?.length ||
              detail.analysis?.learning_path?.length) && (
              <div className="mb-5 space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  解析结果
                </p>
                {detail.analysis.concepts?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      概念
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.analysis.concepts.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {detail.analysis.difficulties?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      难点
                    </p>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {detail.analysis.difficulties.map((d) => (
                        <li key={d} className="flex gap-2">
                          <span className="text-muted-foreground">·</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.analysis.learning_path?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      学习路径
                    </p>
                    <ol className="space-y-1 text-sm text-foreground/90">
                      {detail.analysis.learning_path.map((p, i) => (
                        <li key={p}>
                          {i + 1}. {p}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                正文
              </p>
              {detail.content?.trim() ? (
                <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground/90">
                  {detail.content}
                </pre>
              ) : (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  暂无正文内容（可能是二进制解析失败，可点编辑手动粘贴）
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 列表 ──
  return (
    <div className="flex min-h-[420px] flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题 / 正文 / 文件名"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {courses.length > 0 && (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/40"
            >
              <option value="">全部课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={
              showArchived
                ? "inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-2 text-xs font-medium text-brand"
                : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            }
          >
            <Archive size={14} />
            {showArchived ? "已归档" : "在库"}
          </button>
          {openPanel && (
            <button
              type="button"
              className={primaryBtnCls + " gap-1.5 !py-2 !text-xs"}
              onClick={() => openPanel("materials-upload")}
            >
              <Upload size={14} />
              导入
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div data-lenis-prevent className="flex-1 px-5 py-4">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            加载中…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={showArchived ? "没有已归档资料" : "资料库为空"}
            desc={
              showArchived
                ? "切换到「在库」查看当前资料。"
                : "导入 PDF/ZIP/文本后，可在此查看全文、编辑与归档。"
            }
            action={
              openPanel && !showArchived ? (
                <button
                  type="button"
                  className={primaryBtnCls}
                  onClick={() => openPanel("materials-upload")}
                >
                  导入资料
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => openDetail(l.id)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3.5 text-left transition hover:border-brand/30"
                >
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {l.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {courseName(l.course_id)}
                      {l.file_name ? ` · ${l.file_name}` : ""}
                      {l.analysis?.concepts?.length
                        ? ` · ${l.analysis.concepts.slice(0, 3).join("、")}`
                        : ""}
                    </span>
                    {l.content?.trim() && (
                      <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground/90">
                        {l.content.replace(/\s+/g, " ").slice(0, 160)}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    size={16}
                    className="mt-2 shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>
          共 {total} 份 · 第 {page} 页
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!hasPrev || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted disabled:opacity-40"
            aria-label="上一页"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            disabled={!hasNext || loading}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted disabled:opacity-40"
            aria-label="下一页"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
