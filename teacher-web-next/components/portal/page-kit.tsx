"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** 页面顶部说明块 */
export function PageIntro({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {desc && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {desc}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** 统一空状态 */
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {desc && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 快捷入口卡片 */
export function QuickAction({
  icon,
  title,
  desc,
  onClick,
  badge,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group surface-card flex w-full items-start gap-3 p-4 text-left transition-all hover:border-brand/25 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {desc}
        </span>
      </span>
      <ArrowRight
        size={16}
        className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </button>
  );
}

/** 状态徽章 */
export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-success-soft text-success"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/** 提示条 */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "tip" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/25 bg-amber-500/5"
      : tone === "tip"
        ? "border-emerald-500/25 bg-emerald-500/5"
        : "border-border bg-muted/40";
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed text-muted-foreground ${cls}`}>
      {title && (
        <strong className="mb-0.5 block text-foreground">{title}</strong>
      )}
      {children}
    </div>
  );
}

export const fieldCls =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export const primaryBtnCls =
  "btn-brand disabled:cursor-not-allowed";

export const secondaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
