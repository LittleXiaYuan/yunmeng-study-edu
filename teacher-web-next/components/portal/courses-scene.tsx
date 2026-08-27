"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, PlayCircle } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "@/components/session-provider";

const RotatingCards = dynamic(() => import("@/components/rotating-cards"), {
  ssr: false,
});

/** 单课进度（0-1）：跨该课程所有作业的 step 完成率。 */
function computeCourseProgress(
  courseId: string,
  homeworks: { id: string; course_id: string; steps?: unknown[] }[] | undefined,
  attempts:
    | { homework_id: string; completed_step?: boolean }[]
    | undefined,
): number {
  const list = (homeworks ?? []).filter(
    (h) => h.course_id === courseId,
  );
  let total = 0;
  let done = 0;
  list.forEach((h) => {
    const steps = Array.isArray(h.steps) ? h.steps.length : 0;
    total += steps;
    if (steps > 0) {
      const passed = (attempts ?? []).filter(
        (a) => a.homework_id === h.id && a.completed_step,
      ).length;
      done += Math.min(passed, steps);
    }
  });
  return total > 0 ? done / total : 0;
}

/** 进度环 SVG（默认 56×56，描边 6，进度 0-1）。 */
function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, value));
  const pct = Math.round(value * 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-white">
        {pct}%
      </span>
    </div>
  );
}

/** 选课场景：rotating-cards 3D 圆环 + 顶部续学入口 + 卡片进度环 */
export function CoursesScene({
  currentCourseId,
  onEnter,
  onBack,
  onContinueHomework,
}: {
  currentCourseId: string | null;
  /** 进入所选课程（设为当前课程 + 回学习流）。 */
  onEnter: (courseId: string) => void;
  onBack: () => void;
  /** 续学快捷入口：传 homework id 与 course id，父组件切到 flow 并选中任务。 */
  onContinueHomework?: (homeworkId: string, courseId: string) => void;
}) {
  const { dashboard } = useSession();

  const courses = useMemo(() => {
    const list = (dashboard?.courses ?? []).filter((c) => !c.archived);
    return list.length
      ? list
      : [{ id: "course_db", name: "数据库原理", class_id: "", archived: false }];
  }, [dashboard]);

  // 续学：取当前课程下第一个未完成 homework
  const continueTarget = useMemo(() => {
    const targetCourseId =
      currentCourseId ?? courses[0]?.id ?? "";
    const homeworks = (dashboard?.homeworks ?? []).filter(
      (h) =>
        h.course_id === targetCourseId &&
        !h.archived &&
        h.published,
    );
    const attempts = dashboard?.homework_attempts ?? [];
    for (const h of homeworks) {
      const total = Array.isArray(h.steps) ? h.steps.length : 0;
      const passed = attempts.filter(
        (a) => a.homework_id === h.id && a.completed_step,
      ).length;
      if (total === 0 || passed < total) {
        return { id: h.id, title: h.title, courseId: targetCourseId, passed, total };
      }
    }
    return null;
  }, [dashboard, currentCourseId, courses]);

  const [active, setActive] = useState(0);

  const cards = courses.map((c, i) => {
    const lessons = (dashboard?.lessons ?? []).filter(
      (l) => l.course_id === c.id && !l.archived,
    ).length;
    const progress = computeCourseProgress(
      c.id,
      dashboard?.homeworks,
      dashboard?.homework_attempts,
    );
    const hue = (i * 67) % 360;
    return {
      id: c.id,
      background: `linear-gradient(135deg, hsl(${hue},70%,52%), hsl(${(hue + 40) % 360},72%,42%))`,
      content: (
        <div className="relative flex h-full flex-col justify-between p-5 text-white">
          <BookOpen size={22} className="opacity-80" />
          <ProgressRing value={progress} />
          <div>
            <div className="text-lg font-semibold leading-tight">{c.name}</div>
            <div className="mt-1 text-xs text-white/80">
              {lessons > 0 ? `${lessons} 份教案资料` : "资料准备中"}
            </div>
          </div>
        </div>
      ),
    };
  });

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 py-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回学习
        </button>
        <span className="text-sm font-semibold">选择课程</span>
        <span className="w-16" />
      </div>

      {continueTarget && onContinueHomework && (
        <div className="mx-4 mb-3 rounded-2xl border border-brand/30 bg-brand-soft/50 px-4 py-3 sm:mx-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <PlayCircle size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                继续上次
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {continueTarget.title}
              </p>
              {continueTarget.total > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  进度 {continueTarget.passed} / {continueTarget.total} 步
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                onContinueHomework(continueTarget.id, continueTarget.courseId)
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              继续
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <RotatingCards
          cards={cards}
          radius={240}
          cardWidth={180}
          cardHeight={240}
          draggable
          autoPlay
          pauseOnHover
          onCardClick={(_card, index) => setActive(index)}
          className="h-full w-full"
        />
      </div>

      <motion.div
        key={courses[active]?.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="shrink-0 pb-6 text-center"
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          {courses[active]?.name}
          {courses[active]?.id === currentCourseId && (
            <span className="ml-2 align-middle text-xs font-medium text-accent">
              · 当前课程
            </span>
          )}
        </h2>
        <button
          onClick={() => {
            const id = courses[active]?.id;
            if (id) onEnter(id);
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
        >
          进入该课程学习
          <ArrowRight size={16} />
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          拖动圆环切换课程
        </p>
      </motion.div>
    </div>
  );
}
