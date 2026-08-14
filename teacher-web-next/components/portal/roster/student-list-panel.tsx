"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { StudentListItem } from "@/lib/types";
import type { OpenPanel } from "../panel-registry";

const PAGE_SIZE = 12;

/**
 * 学生名单只读面板（Step 4）：搜索 + 分页 + 班级筛选。
 * 教师端由后端 DashboardFor 天然限定为本班学生；超管端可见全校。
 * 行操作（编辑/归档/详情）在 Step 5–6 接入，这里先做只读浏览。
 */
export function StudentListPanel({
  openPanel,
  classId: fixedClassId,
}: {
  openPanel: OpenPanel;
  /** 预置班级过滤（如从班级画像下钻时传入），留空则全部班级。 */
  classId?: string;
}) {
  const { dashboard } = useSession();
  const classes = useMemo(
    () => (dashboard?.classes ?? []).filter((c) => !c.archived),
    [dashboard],
  );
  const classNameById = useMemo(() => {
    const m = new Map<string, string>();
    (dashboard?.classes ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [dashboard]);

  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [classFilter, setClassFilter] = useState(fixedClassId ?? "");
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [items, setItems] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 行内操作状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // 关键词防抖，回到第 1 页
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    setPage(1);
  }, [classFilter, showArchived]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listStudents({
        page,
        pageSize: PAGE_SIZE,
        keyword: debounced || undefined,
        classId: classFilter || undefined,
        // 默认只看在读；开启后看已归档
        archived: showArchived ? true : false,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setHasNext(res.has_next);
      setHasPrev(res.has_prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, debounced, classFilter, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  /** 归档 / 取消归档：走 upsert，成功后刷新当前页。 */
  const toggleArchive = useCallback(
    async (s: StudentListItem) => {
      setRowBusy(s.id);
      setError("");
      try {
        await api.archiveStudent(s.id, !s.archived);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      } finally {
        setRowBusy(null);
      }
    },
    [load],
  );

  /** 提交行内改名。 */
  const commitRename = useCallback(
    async (s: StudentListItem) => {
      const name = editName.trim();
      if (!name || name === s.name) {
        setEditingId(null);
        return;
      }
      setRowBusy(s.id);
      setError("");
      try {
        await api.updateStudent(s.id, { name });
        setEditingId(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "改名失败");
      } finally {
        setRowBusy(null);
      }
    },
    [editName, load],
  );

  return (
    <div className="flex flex-col">
      {/* 搜索 + 班级筛选 */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索学生姓名 / 账号 / ID"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <div className="flex items-center gap-2">
          {classes.length > 0 && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              disabled={Boolean(fixedClassId)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/40 disabled:opacity-60"
            >
              <option value="">全部班级</option>
              {classes.map((c) => (
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
                ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3.5 py-2 text-xs font-medium text-brand"
                : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            }
            title={showArchived ? "查看在读学生" : "查看已归档学生"}
          >
            <Archive size={14} />
            {showArchived ? "已归档" : "在读"}
          </button>
        </div>
      </div>

      <div data-lenis-prevent className="px-5 py-4 sm:px-6">
        {error && (
          <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-sm text-muted-foreground">
            <Users size={24} className="text-brand/50" />
            未找到学生
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((s) => {
              const editing = editingId === s.id;
              const busy = rowBusy === s.id;
              return (
                <li
                  key={s.id}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-3.5 py-3 transition-colors hover:border-brand/30"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                    {s.name.slice(0, 1) || "学"}
                  </span>

                  {editing ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(s);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand/40"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openPanel("student-detail", { id: s.id, name: s.name })
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-semibold">
                        {s.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {classNameById.get(s.class_id) || s.class_id || "未分班"}
                      </span>
                    </button>
                  )}

                  {busy ? (
                    <Loader2
                      size={16}
                      className="shrink-0 animate-spin text-muted-foreground"
                    />
                  ) : editing ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => commitRename(s)}
                        aria-label="保存"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-success transition-colors hover:bg-success-soft"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="取消"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(s.id);
                          setEditName(s.name);
                        }}
                        aria-label="重命名"
                        title="重命名"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(s)}
                        aria-label={s.archived ? "取消归档" : "归档"}
                        title={s.archived ? "取消归档" : "归档"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        {s.archived ? (
                          <ArchiveRestore size={14} />
                        ) : (
                          <Archive size={14} />
                        )}
                      </button>
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground/50"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3.5 text-xs text-muted-foreground sm:px-6">
        <span>
          共 {total} 名 · 第 {page} 页
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPrev || loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="上一页"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="下一页"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
