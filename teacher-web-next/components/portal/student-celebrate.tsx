"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  User,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { useSession } from "@/components/session-provider";
import { studentAttempts, studentProfileStats } from "@/lib/portal-helpers";
import type { HomeworkTask } from "@/lib/types";

const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

/**
 * 通关页：一屏一主 CTA。
 * 有下一项 → 主按钮「接着练」；否则画像 / 教练。
 */
export function StudentCelebrate({
  homework,
  onProfile,
  onChat,
  nextHomework,
  onNext,
}: {
  homework: HomeworkTask;
  onProfile: () => void;
  onChat: () => void;
  nextHomework?: HomeworkTask | null;
  onNext?: () => void;
}) {
  const { user, dashboard } = useSession();
  const reduceMotion = useReducedMotion();

  const attempts = useMemo(
    () => studentAttempts(dashboard, user),
    [dashboard, user],
  );
  const stats = useMemo(
    () => studentProfileStats(attempts, dashboard),
    [attempts, dashboard],
  );
  const remark =
    attempts.filter((a) => a.homework_id === homework.id).slice(-1)[0]
      ?.guidance ??
    "你完成了全部阶段。把讲得清楚的地方记下来，会越来越稳。";

  const hasNext = Boolean(nextHomework && onNext);

  return (
    <div className="relative mx-auto max-w-lg px-6 py-12 text-center sm:py-16">
      {!reduceMotion && (
        <Confetti
          recycle={false}
          numberOfPieces={120}
          gravity={0.3}
          tweenDuration={3200}
          colors={["#1a73e8", "#8ab4f8", "#0d9f6e", "#fbbf24"]}
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 40,
          }}
        />
      )}

      <motion.div
        initial={reduceMotion ? false : { scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-soft text-success"
      >
        <CheckCircle2 size={40} />
      </motion.div>

      <p className="text-sm font-medium text-success">这题练完了</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        做得好，{user?.name ?? "同学"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        「{homework.title}」全部阶段已通过。
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat label="信任分" value={stats.score} />
        <Stat label="通过阶段" value={stats.completed} />
        <Stat label="迭代" value={stats.revisions} />
      </div>

      <div className="surface-card mt-8 p-5 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          教练评语
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {remark}
        </p>
      </div>

      {/* 主 CTA：有下一项就续练，保持沉浸 */}
      <div className="mt-8 flex flex-col gap-3">
        {hasNext ? (
          <button
            type="button"
            onClick={onNext}
            className="btn-brand w-full gap-2 py-3.5 text-base sm:mx-auto sm:w-auto sm:min-w-[240px]"
          >
            接着练：{nextHomework!.title}
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onProfile}
            className="btn-brand w-full gap-2 py-3.5 text-base sm:mx-auto sm:w-auto sm:min-w-[200px]"
          >
            <User size={16} />
            看看学习画像
          </button>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {hasNext && (
            <button
              type="button"
              onClick={onProfile}
              className="btn-ghost gap-2"
            >
              <User size={16} />
              学习画像
            </button>
          )}
          <button type="button" onClick={onChat} className="btn-ghost gap-2">
            <MessageCircle size={16} />
            和教练复盘
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-3">
      <p className="text-xl font-semibold tabular-nums tracking-tight">
        <NumberTicker value={value} />
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
