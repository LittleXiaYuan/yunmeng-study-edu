"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserCog,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { User } from "@/lib/types";

const PAGE_SIZE = 12;

type RoleFilter = "" | "admin" | "teacher" | "student";

interface CreateForm {
  username: string;
  password: string;
  name: string;
  role: "admin" | "teacher" | "student";
  class_ids: string[];
}

const EMPTY_FORM: CreateForm = {
  username: "",
  password: "",
  name: "",
  role: "teacher",
  class_ids: [],
};

function roleLabel(role: string) {
  if (role === "admin") return "超管";
  if (role === "teacher") return "教师";
  if (role === "student") return "学生";
  return role;
}

function roleBadgeTone(role: string) {
  if (role === "admin") return "bg-brand-soft text-brand";
  if (role === "teacher") return "bg-success-soft text-success";
  return "bg-muted text-muted-foreground";
}

/**
 * 超管「账号管理」面板：搜索 + 分页 + 角色 / 在用筛选 + 新建 + 启用/停用。
 * 后端已用 sanitizeUser 剥离 password_hash，列表里不会再有密码相关字段。
 */
export function UserListPanel() {
  const { dashboard, refresh } = useSession();
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
  const [role, setRole] = useState<RoleFilter>("");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // 关键词防抖 + 跳第 1 页
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    setPage(1);
  }, [role, showInactive]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listUsers({
        page,
        pageSize: PAGE_SIZE,
        keyword: debounced || undefined,
        role: role || undefined,
        archived: showInactive ? true : false,
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
  }, [page, debounced, role, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  // 新建账号抽屉
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setCreateError("");
  }

  function toggleClass(id: string) {
    setForm((prev) => ({
      ...prev,
      class_ids: prev.class_ids.includes(id)
        ? prev.class_ids.filter((x) => x !== id)
        : [...prev.class_ids, id],
    }));
  }

  async function submitCreate() {
    const username = form.username.trim();
    const password = form.password;
    const name = form.name.trim();
    if (!username || !password || !name) {
      setCreateError("账号 / 密码 / 姓名 都不能为空");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await api.createUser({
        username,
        password,
        name,
        role: form.role,
        class_ids: form.role === "teacher" ? form.class_ids : [],
        active: true,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
      await refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  /** 启用 / 停用一行。 */
  const toggleActive = useCallback(
    async (u: User) => {
      setRowBusy(u.id);
      setError("");
      try {
        await api.updateUser(u.id, { active: !u.active });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "状态切换失败");
      } finally {
        setRowBusy(null);
      }
    },
    [load],
  );

  return (
    <div className="flex flex-col">
      {/* 搜索 + 角色 + 在用筛选 + 新建按钮 */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索账号 / 姓名 / ID"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="btn-brand shrink-0 gap-1.5"
          >
            <UserPlus size={15} />
            新建账号
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleFilter)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/40"
          >
            <option value="">全部角色</option>
            <option value="admin">超管</option>
            <option value="teacher">教师</option>
            <option value="student">学生</option>
          </select>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={
              showInactive
                ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3.5 py-2 text-xs font-medium text-brand"
                : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            }
            title={showInactive ? "查看所有账号" : "仅看在用"}
          >
            <UserCheck size={14} />
            {showInactive ? "全部" : "在用"}
          </button>
        </div>
      </div>

      <div data-lenis-prevent className="px-5 py-4 sm:px-6">
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
          >
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
            <UsersIcon size={24} className="text-brand/50" />
            未找到账号
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((u) => {
              const busy = rowBusy === u.id;
              const roleIcon =
                u.role === "admin" ? (
                  <Shield size={13} />
                ) : u.role === "teacher" ? (
                  <UserCog size={13} />
                ) : (
                  <UsersIcon size={13} />
                );
              const classNames = (u.class_ids ?? [])
                .map((id) => classNameById.get(id) || id)
                .filter(Boolean);
              return (
                <li
                  key={u.id}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-3.5 py-3 transition-colors hover:border-brand/30"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                    {u.name.slice(0, 1) || "用"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {u.name}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBadgeTone(u.role)}`}
                      >
                        {roleIcon}
                        {roleLabel(u.role)}
                      </span>
                      {!u.active && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-medium text-danger">
                          已停用
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                      <span className="font-mono">@{u.username}</span>
                      {classNames.length > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span className="truncate">
                            {classNames.join("、")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {busy ? (
                    <Loader2
                      size={16}
                      className="shrink-0 animate-spin text-muted-foreground"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      aria-label={u.active ? "停用此账号" : "启用此账号"}
                      title={u.active ? "停用此账号" : "启用此账号"}
                      className={
                        u.active
                          ? "inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          : "inline-flex h-8 items-center gap-1 rounded-lg border border-brand bg-brand-soft px-2.5 text-xs text-brand opacity-0 transition-all group-hover:opacity-100"
                      }
                    >
                      {u.active ? (
                        <>
                          <Archive size={13} />
                          停用
                        </>
                      ) : (
                        <>
                          <ArchiveRestore size={13} />
                          启用
                        </>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3.5 text-xs text-muted-foreground sm:px-6">
        <span>
          共 {total} 个 · 第 {page} 页
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

      {/* 新建账号抽屉 */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
          onClick={closeCreate}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="新建账号"
            className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-background shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">新建账号</h3>
              <button
                type="button"
                onClick={closeCreate}
                aria-label="关闭"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {createError && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
                >
                  {createError}
                </div>
              )}
              <Field label="姓名 *">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：王老师"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="账号 *">
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="登录账号"
                    className={inputCls}
                    autoComplete="off"
                  />
                </Field>
                <Field label="密码 *">
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="初始密码"
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <Field label="角色 *">
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as CreateForm["role"],
                      class_ids:
                        e.target.value === "teacher" ? form.class_ids : [],
                    })
                  }
                  className={inputCls}
                >
                  <option value="teacher">教师</option>
                  <option value="admin">超管</option>
                  <option value="student">学生</option>
                </select>
              </Field>
              {form.role === "teacher" && (
                <Field label="归属班级（可多选）">
                  {classes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      暂无班级；先在「班级课程」里建班级。
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {classes.map((c) => {
                        const on = form.class_ids.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleClass(c.id)}
                            className={
                              on
                                ? "inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-2.5 py-1 text-xs text-brand"
                                : "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            }
                          >
                            {on && <Check size={11} />}
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                className="btn-ghost flex-1"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={creating}
                className="btn-brand flex-1"
              >
                {creating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                {creating ? "创建中…" : "创建并启用"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/15";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
