"use client";

import {
  AlertTriangle,
  Award,
  Camera,
  Loader2,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { useSession } from "@/components/session-provider";
import { API_BASE_URL } from "@/lib/api";
import { studentAttempts, studentProfileStats } from "@/lib/portal-helpers";
import { PageIntro } from "./page-kit";

/**
 * 学习画像 — 与「今日」同级的宽版 layout + brand tokens
 */
export function StudentProfile() {
  const { user, dashboard, busy, uploadAvatar, uploadBackground } =
    useSession();

  const attempts = useMemo(
    () => studentAttempts(dashboard, user),
    [dashboard, user],
  );
  const stats = useMemo(
    () => studentProfileStats(attempts, dashboard),
    [attempts, dashboard],
  );
  const initials = (user?.name || "学")[0];

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const uploadingAvatar = busy === "avatar";
  const uploadingBackground = busy === "background";

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 pb-16 sm:px-8">
      <PageIntro
        eyebrow="画像"
        title="学习画像"
        desc="信任分、理解度与薄弱点来自真实练习记录。"
      />

      <div className="surface-card overflow-hidden">
        {/* 头图：品牌渐变，非纯黑 */}
        <div className="relative h-32 bg-linear-to-br from-brand via-brand/80 to-[#0e0e0e] sm:h-40">
          {user?.background_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_BASE_URL}${user.background_url}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadBackground(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            disabled={uploadingBackground}
            aria-label="更换背景图"
            className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3 text-xs font-medium text-white backdrop-blur hover:bg-black/60 disabled:opacity-70"
          >
            {uploadingBackground ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            背景
          </button>
        </div>

        <div className="relative px-5 pb-7 pt-0 sm:px-8">
          <div className="relative z-10 -mt-12 mb-6 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-brand text-3xl font-bold text-brand-foreground shadow-lg sm:text-4xl">
                {user?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_BASE_URL}${user.avatar_url}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="更换头像"
                className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-brand text-brand-foreground shadow-sm hover:opacity-90 disabled:opacity-70"
              >
                {uploadingAvatar ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
              </button>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {user?.name || "同学"}
                </h1>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
                  {stats.style}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {stats.hasMemory ? "真实画像" : "推导画像"}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                @{user?.username}
                <span className="mx-1.5 text-border">·</span>
                {dashboard?.courses?.[0]?.name || "数据库原理"}
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <MetricCard label="信任分" value={stats.score} hint="0–100" accent />
            <MetricCard
              label="理解程度"
              value={stats.understandingScore}
              hint="掌握度"
            />
            <MetricCard
              label="迭代修改"
              value={stats.revisions}
              hint="次"
            />
          </div>

          <div className="mb-6 rounded-2xl border border-border bg-muted/25 p-5 sm:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <TrendingUp size={18} className="text-brand" />
              能力画像
            </h3>
            <div className="flex flex-col gap-4">
              {stats.bars.map(([label, val]) => {
                const pct = Math.max(0, Math.min(100, Number(val) || 0));
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-muted-foreground">
                      {label}
                    </span>
                    <div
                      className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-background"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={label}
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
                      <NumberTicker value={pct} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Target size={16} className="text-brand" />
                重点提示
              </h3>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                {stats.weakness.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/50" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {stats.commonErrors.length > 0 && (
                <>
                  <h3 className="mb-3 mt-5 flex items-center gap-2 text-base font-semibold">
                    <AlertTriangle size={16} className="text-amber-500" />
                    常见错误
                  </h3>
                  <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                    {stats.commonErrors.map((e) => (
                      <li key={e} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Award size={16} className="text-brand" />
                学习记录
              </h3>
              <ul className="flex flex-col gap-2">
                {attempts
                  .slice(-6)
                  .reverse()
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground"
                    >
                      <span>
                        {a.completed_homework ? "已完成" : "进行中"} · 第{" "}
                        {a.step_index + 1} 阶段
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-trust">
                        {a.trust_score}
                      </span>
                    </li>
                  ))}
                {attempts.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    暂无记录，完成任务后会出现在这里
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-brand/25 bg-brand-soft px-3 py-4 text-center sm:px-4 sm:py-5"
          : "rounded-2xl border border-border bg-background px-3 py-4 text-center sm:px-4 sm:py-5"
      }
    >
      <div
        className={
          accent
            ? "text-2xl font-semibold tabular-nums tracking-tight text-trust sm:text-3xl"
            : "text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl"
        }
      >
        <NumberTicker value={value} />
      </div>
      <div className="mt-1 text-xs font-medium text-foreground sm:text-sm">
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
