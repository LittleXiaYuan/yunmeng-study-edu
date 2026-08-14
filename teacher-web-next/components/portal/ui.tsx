"use client";

import {
  Archive,
  CheckCircle2,
  ChevronDown,
  FileText,
  LogOut,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { useSession } from "@/components/session-provider";
import type { HomeworkTask } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileMenu } from "./profile-menu";

const roleName: Record<string, string> = {
  admin: "管理员",
  teacher: "教师",
  student: "学生",
};

/** 叶子导航项 */
export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** 可选：侧栏角标 */
  badge?: string | number;
}

/**
 * 侧栏分组：大类 + 可选小类。
 * - children 有值 → 可展开大类，点小类切换
 * - 无 children → 自身即叶子（如「工作台」）
 */
export interface NavGroup {
  id: string;
  label: string;
  icon: ReactNode;
  /** 叶子路由 id；无 children 时点击走 onSelect(id) */
  href?: string;
  children?: NavItem[];
  /** 默认展开 */
  defaultOpen?: boolean;
}

/** 兼容旧 API：扁平 items 可转成单层 groups */
function toGroups(items: NavItem[]): NavGroup[] {
  return items.map((it) => ({
    id: it.id,
    label: it.label,
    icon: it.icon ?? null,
    href: it.id,
  }));
}

const SIDEBAR_W = "16rem"; // w-64

/** 固定侧栏 + 主内容偏移；支持大类 / 小类 */
export function PortalShell({
  title,
  subtitle,
  items,
  groups,
  active,
  onSelect,
  children,
  floating,
  headerActions,
  sidebarFooter,
}: {
  title: string;
  subtitle: string;
  /** @deprecated 优先用 groups；无 groups 时用扁平 items */
  items?: NavItem[];
  groups?: NavGroup[];
  active: string;
  onSelect: (id: string) => void;
  children: ReactNode;
  floating?: ReactNode;
  headerActions?: ReactNode;
  sidebarFooter?: ReactNode;
}) {
  const { user, notice, error, refresh, logout } = useSession();
  const router = useRouter();

  const navGroups = groups ?? toGroups(items ?? []);

  // 展开状态：当前 active 所在组强制展开
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of navGroups) {
      const hasActiveChild = g.children?.some((c) => c.id === active);
      init[g.id] = g.defaultOpen ?? hasActiveChild ?? !g.children;
    }
    return init;
  });

  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      for (const g of navGroups) {
        if (g.children?.some((c) => c.id === active)) {
          next[g.id] = true;
        }
      }
      return next;
    });
  }, [active, navGroups]);

  function toggleGroup(id: string) {
    setOpenMap((m) => ({ ...m, [id]: !m[id] }));
  }

  // 移动端底栏：只收叶子项
  const leafItems: NavItem[] = [];
  for (const g of navGroups) {
    if (g.children?.length) {
      for (const c of g.children) leafItems.push(c);
    } else {
      leafItems.push({ id: g.href ?? g.id, label: g.label, icon: g.icon });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── 固定侧栏 ── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card min-[901px]:flex"
        style={{ width: SIDEBAR_W }}
      >
        <div className="flex h-full flex-col px-3 py-5">
          <div className="mb-6 flex items-center gap-3 px-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <Sparkles size={18} />
            </span>
            <div className="leading-tight">
              <strong className="block text-sm font-semibold tracking-tight">
                云雀教学
              </strong>
              <span className="text-xs text-muted-foreground">
                {roleName[user?.role ?? ""] ?? user?.role}
              </span>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5">
            {navGroups.map((g) => {
              const hasKids = Boolean(g.children?.length);
              const leafId = g.href ?? g.id;
              const groupActive =
                active === leafId ||
                Boolean(g.children?.some((c) => c.id === active));
              const expanded = openMap[g.id] ?? groupActive;

              if (!hasKids) {
                return (
                  <button
                    key={g.id}
                    type="button"
                    data-tour={leafId}
                    onClick={() => onSelect(leafId)}
                    className={
                      active === leafId
                        ? "flex items-center gap-3 rounded-xl bg-brand px-3 py-2.5 text-sm font-medium text-brand-foreground"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    }
                  >
                    <span className="shrink-0 opacity-90">{g.icon}</span>
                    <span className="flex-1 text-left">{g.label}</span>
                  </button>
                );
              }

              return (
                <div key={g.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={
                      groupActive
                        ? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand"
                        : "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }
                    aria-expanded={expanded}
                  >
                    <span className="shrink-0">{g.icon}</span>
                    <span className="flex-1">{g.label}</span>
                    <ChevronDown
                      size={14}
                      className={
                        expanded
                          ? "shrink-0 transition-transform"
                          : "shrink-0 -rotate-90 transition-transform"
                      }
                    />
                  </button>
                  {expanded && (
                    <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                      {g.children!.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          data-tour={c.id}
                          onClick={() => onSelect(c.id)}
                          className={
                            active === c.id
                              ? "flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-left text-sm font-medium text-brand"
                              : "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          }
                        >
                          {c.icon && (
                            <span className="shrink-0 opacity-80">{c.icon}</span>
                          )}
                          <span className="flex-1 truncate">{c.label}</span>
                          {c.badge != null && c.badge !== "" && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                              {c.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {sidebarFooter}
            <div className="px-2">
              <strong className="block truncate text-sm">
                {user?.name ?? user?.username}
              </strong>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.username}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── 主区：为固定侧栏留白 ── */}
      <div
        className="flex min-h-screen min-w-0 flex-col pb-20 min-[901px]:pb-0"
        style={{ marginLeft: 0 }}
      >
        <div className="min-[901px]:ml-64">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {headerActions}
              <ThemeToggle size="sm" />
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RefreshCw size={15} />
                <span className="max-[520px]:hidden">刷新</span>
              </button>
              <ProfileMenu align="end" variant="portal" />
            </div>
          </header>
          <StatusLine notice={notice} error={error} />
          <main className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</main>
        </div>
      </div>

      {/* 移动端底栏：叶子项最多 5 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur min-[901px]:hidden">
        {leafItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            type="button"
            data-tour={item.id}
            onClick={() => onSelect(item.id)}
            className={
              active === item.id
                ? "flex flex-1 flex-col items-center gap-1 py-2.5 text-brand"
                : "flex flex-1 flex-col items-center gap-1 py-2.5 text-muted-foreground"
            }
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>

      {floating}
    </div>
  );
}

export function StatusLine({
  notice,
  error,
}: {
  notice: string;
  error: string;
}) {
  if (!notice && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={
        error
          ? "mx-6 mt-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger sm:mx-8"
          : "mx-6 mt-4 rounded-xl border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success sm:mx-8"
      }
    >
      {error || notice}
    </div>
  );
}

/** Segmented sub-tab control — brand pill active. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={
            value === o.key
              ? "rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground"
              : "rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  detail,
  trend,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  trend?: string;
}) {
  return (
    <div className="surface-card relative overflow-hidden p-5 transition hover:border-brand/30 hover:shadow-[var(--shadow-float)] sm:p-6">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          <NumberTicker value={value} />
        </span>
        {trend && (
          <em className="text-xs font-medium not-italic text-success">
            {trend}
          </em>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export function Panel({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-6 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {desc && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: string[][];
  empty: string;
}) {
  const hasRows = rows.length > 0;
  return (
    <section className="surface-card p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <FileText size={16} />
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {!hasRows ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.slice(0, 10).map((row, i) => (
            <div
              key={`${row.join("-")}-${i}`}
              className="grid grid-cols-3 gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-muted/50"
            >
              {row.slice(0, 3).map((cell, ci) => (
                <span
                  key={ci}
                  className={
                    ci === 0
                      ? "truncate font-medium text-foreground"
                      : "truncate text-muted-foreground"
                  }
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TaskList({ items }: { items: HomeworkTask[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const visible = items.slice().reverse();
  return (
    <section className="surface-card p-6 sm:p-7">
      <h2 className="mb-4 text-base font-semibold tracking-tight">
        任务列表{" "}
        <span className="font-normal text-muted-foreground">
          ({visible.length})
        </span>
      </h2>
      {visible.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
          <Archive size={16} />
          暂无任务
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((item) => {
            const isActive = selected === item.id;
            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(isActive ? null : item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(isActive ? null : item.id);
                  }
                }}
                className={
                  isActive
                    ? "flex cursor-pointer gap-3 rounded-2xl border border-brand bg-brand-soft/50 p-4 transition-colors"
                    : "flex cursor-pointer gap-3 rounded-2xl border border-border bg-background/50 p-4 transition-colors hover:border-brand/30 hover:bg-muted/40"
                }
              >
                {item.published ? (
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-success"
                  />
                ) : (
                  <FileText
                    size={18}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold">
                    {item.title}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {item.published ? "已发布到学生端" : "草稿"} ·{" "}
                    {(item.steps || []).length} 步
                  </span>
                  {item.prompt && (
                    <p
                      className={
                        isActive
                          ? "mt-1.5 text-xs leading-relaxed text-muted-foreground"
                          : "mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                      }
                    >
                      {item.prompt}
                    </p>
                  )}
                  {isActive && item.steps && item.steps.length > 0 && (
                    <ol className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                      {item.steps.map((s) => (
                        <li
                          key={s.index}
                          className="text-xs text-muted-foreground"
                        >
                          {s.index + 1}. {s.title}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h3 className="mb-3 text-base font-semibold tracking-tight">{title}</h3>
      <div className="flex flex-col gap-1">
        {(items.length ? items : ["暂无数据"]).slice(0, 8).map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/50" />
            <span className="truncate">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
