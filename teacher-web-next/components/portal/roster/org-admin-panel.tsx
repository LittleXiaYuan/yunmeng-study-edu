"use client";

import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  School as SchoolIcon,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { School } from "@/lib/types";
import { fieldCls, primaryBtnCls } from "../page-kit";

/**
 * 学校与组织（超管）：学校 CRUD + 归档 + 按学校分组看班级。
 * 教师/学生由后端 DashboardFor 按班级隔离，天然看不到他校数据。
 */
export function OrgAdminPanel() {
  const { dashboard, refresh } = useSession();

  const [schools, setSchools] = useState<School[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 新建/编辑
  const [editing, setEditing] = useState<School | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listSchools({
        page: 1,
        pageSize: 50,
        keyword: debounced || undefined,
      });
      setSchools(res.items ?? []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const classesBySchool = useMemo(() => {
    const m = new Map<string, { id: string; name: string; archived: boolean }[]>();
    (dashboard?.classes ?? []).forEach((c) => {
      const key = c.school_id || "";
      const arr = m.get(key) ?? [];
      arr.push({ id: c.id, name: c.name, archived: c.archived });
      m.set(key, arr);
    });
    return m;
  }, [dashboard]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(s: School) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await api.upsertSchool({
        id: editing?.id,
        name: name.trim(),
        code: code.trim(),
      });
      if (res.message) setNotice(res.message);
      setFormOpen(false);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(s: School) {
    if (rowBusy) return;
    setRowBusy(s.id);
    setError("");
    setNotice("");
    try {
      const res = await api.upsertSchool({
        id: s.id,
        name: s.name,
        code: s.code,
        archived: !s.archived,
      });
      if (res.message) setNotice(res.message);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setRowBusy(null);
    }
  }

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
            placeholder="搜索学校名称 / 编码"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <button
          type="button"
          className={primaryBtnCls + " gap-1.5 !py-2 !text-xs"}
          onClick={openCreate}
        >
          <Plus size={14} />
          新建学校
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-foreground">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand" />
          {notice}
        </div>
      )}

      {formOpen && (
        <div className="mx-5 mt-4 flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand-soft/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {editing ? "编辑学校" : "新建学校"}
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="关闭"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                学校名称 *
              </span>
              <input
                className={fieldCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：云元外国语学院"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                编码（可选）
              </span>
              <input
                className={fieldCls}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如：YUNYUAN-3"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={primaryBtnCls + " !py-2 !text-xs"}
              disabled={saving || !name.trim()}
              onClick={save}
            >
              {saving ? "保存中…" : editing ? "保存修改" : "确认创建"}
            </button>
            <button
              type="button"
              className="btn-ghost !text-xs"
              onClick={() => setFormOpen(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div data-lenis-prevent className="flex-1 px-5 py-4">
        {loading && schools.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            加载中…
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <SchoolIcon size={22} />
            </span>
            <p className="text-sm text-muted-foreground">
              {debounced ? "没有匹配的学校" : "还没有学校，点右上角新建"}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {schools.map((s) => {
              const cls = classesBySchool.get(s.id) ?? [];
              const activeCls = cls.filter((c) => !c.archived);
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-border bg-background/60 px-4 py-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Building2 size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {s.name}
                        {s.archived && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            已归档
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.code || "未设编码"} · {activeCls.length} 个班级
                      </p>
                      {activeCls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {activeCls.map((c) => (
                            <span
                              key={c.id}
                              className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(s)}
                        disabled={rowBusy === s.id}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
                      >
                        {s.archived ? (
                          <>
                            <ArchiveRestore size={13} />
                            恢复
                          </>
                        ) : (
                          <>
                            <Archive size={13} />
                            归档
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>共 {total} 所学校</span>
        <span>班级在「班级与课程」视图管理</span>
      </div>
    </div>
  );
}
