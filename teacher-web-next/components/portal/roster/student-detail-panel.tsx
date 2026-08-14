"use client";

import {
  AlertCircle,
  Brain,
  Clock,
  Loader2,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { thinkingStyleLabel } from "@/lib/portal-helpers";
import type { StudentDetail } from "@/lib/types";

/** 信任分 → 披露层级标签（与后端 TrustPolicyFor 的分档一致）。 */
function trustTier(score: number): string {
  if (score >= 85) return "可解释（explain）";
  if (score >= 70) return "部分披露（partial）";
  if (score >= 50) return "提示（hint）";
  return "仅提问（locked）";
}

function ScoreRing({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--brand) ${pct * 3.6}deg, var(--muted) 0deg)`,
        }}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-sm font-semibold tabular-nums">
          {value}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * 学生详情面板（Step 6）：TrustScore / 理解分 / 思维风格 / 知识弱点 / 常见错误 + 学习轨迹。
 * 数据来自后端 StudentDetail（Student + memory + sessions）。
 * memory 为空表示该生尚无真实学习数据，显示占位而非 0 分误导。
 */
export function StudentDetailPanel({
  id,
  name,
}: {
  id: string;
  name?: string;
}) {
  const { dashboard } = useSession();
  const className =
    (dashboard?.classes ?? []).find(
      (c) => c.id === (dashboard?.students ?? []).find((s) => s.id === id)?.class_id,
    )?.name ?? "";

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .getStudentDetail(id)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        加载学情中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-5 flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-300">
        <AlertCircle size={15} />
        {error}
      </div>
    );
  }

  const mem = detail?.memory;
  const sessions = detail?.sessions ?? [];
  const displayName = detail?.name || name || id;

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-7">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-lg font-semibold text-brand">
          {displayName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight">
            {displayName}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {className || detail?.class_id || "未分班"}
            {detail?.archived ? " · 已归档" : ""}
          </p>
        </div>
      </div>

      {!mem ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <Brain size={24} className="mx-auto mb-2 text-brand/40" />
          该生尚无学习数据
          <p className="mt-1 text-xs">
            学生完成任务 / 对话后，这里将呈现信任分、知识弱点与学习轨迹。
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <ScoreRing label="信任分" value={mem.trust_score} />
            <ScoreRing label="理解分" value={mem.understanding_score} />
            <ScoreRing label="反思水平" value={mem.reflection_level} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={13} className="text-brand" />
                披露层级
              </div>
              <div className="text-sm font-semibold">
                {trustTier(mem.trust_score)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain size={13} className="text-brand" />
                思维风格
              </div>
              <div className="text-sm font-semibold">
                {thinkingStyleLabel(mem.thinking_style)}
              </div>
            </div>
          </div>

          {/* 知识弱点 */}
          {mem.knowledge_weakness.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Target size={13} />
                知识弱点
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mem.knowledge_weakness.map((w, i) => (
                  <span
                    key={`${w}-${i}`}
                    className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 常见错误 */}
          {mem.common_errors.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlertCircle size={13} />
                常见错误
              </div>
              <ul className="flex flex-col gap-1">
                {mem.common_errors.map((e, i) => (
                  <li
                    key={`${e}-${i}`}
                    className="flex items-start gap-1.5 text-xs text-foreground/85"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* 学习轨迹 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock size={13} />
          学习轨迹 {sessions.length > 0 && `· ${sessions.length} 条`}
        </div>
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            暂无学习记录
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {sessions.map((sess) => (
              <li
                key={sess.id}
                className="rounded-2xl border border-border bg-background px-4 py-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(sess.created_at).toLocaleString("zh-CN")}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    信任 {sess.trust_score}
                  </span>
                </div>
                {sess.input && (
                  <p className="line-clamp-2 text-xs text-foreground/85">
                    {sess.input}
                  </p>
                )}
                {sess.evaluation?.error_types?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sess.evaluation.error_types.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
