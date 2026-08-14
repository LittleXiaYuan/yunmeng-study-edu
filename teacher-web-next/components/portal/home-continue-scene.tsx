"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { useSession } from "@/components/session-provider";
import { nextStepIndex, type StudentTask } from "@/lib/portal-helpers";
import type { Course, HomeworkTask } from "@/lib/types";

type Mode = "continue" | "start" | "all_done" | "empty";

/**
 * 学生「今日」— 按 frontend-design / ui-ux-pro-max：
 * - 每屏一个主 CTA（继续/开始练习）
 * - 不堆与底栏重复的「快捷入口」
 * - 课程 = 轻量过滤器，不是第二导航
 * - 待办最多 3 条，完整清单在「任务」
 */
export function HomeContinueScene({
  activeHomework,
  homeworkDone,
  taskList,
  allTaskList,
  currentCourseId,
  trustScore,
  styleLabel,
  weakness,
  onContinue,
  onOpenTasks,
  onOpenAsk,
  onOpenCourses,
  onSelectTask,
  onSelectCourse,
}: {
  activeHomework: HomeworkTask | null | undefined;
  homeworkDone: boolean;
  taskList: StudentTask[];
  allTaskList: StudentTask[];
  currentCourseId: string | null;
  trustScore: number;
  understandingScore: number;
  styleLabel: string;
  weakness: string[];
  completedSteps: number;
  onContinue: () => void;
  onOpenTasks: () => void;
  onOpenAsk: () => void;
  onOpenCourses: () => void;
  onOpenProfile: () => void;
  onOpenFlow: () => void;
  onSelectTask?: (homeworkId: string) => void;
  onSelectCourse: (courseId: string | null) => void;
}) {
  const { user, dashboard } = useSession();
  const reduceMotion = useReducedMotion();

  const courses = useMemo(
    () => (dashboard?.courses ?? []).filter((c) => !c.archived),
    [dashboard],
  );

  const pendingInScope = useMemo(
    () => taskList.filter((t) => t.status !== "done"),
    [taskList],
  );
  const firstPending = pendingInScope[0];
  const globalPending = allTaskList.filter((t) => t.status !== "done").length;

  const mode: Mode = useMemo(() => {
    if (activeHomework && !homeworkDone) {
      const st = taskList.find(
        (t) => t.homework.id === activeHomework.id,
      )?.status;
      if (st === "in_progress") return "continue";
      return "start";
    }
    if (firstPending) return "start";
    if (taskList.length > 0) return "all_done";
    return "empty";
  }, [activeHomework, homeworkDone, firstPending, taskList]);

  const focusHw =
    mode === "continue" || (mode === "start" && activeHomework && !homeworkDone)
      ? activeHomework
      : mode === "start"
        ? firstPending?.homework
        : null;

  const focusCourseName =
    focusHw && courses.find((c) => c.id === focusHw.course_id)?.name;

  const nextTasks = useMemo(() => {
    const pending = allTaskList.filter((t) => t.status !== "done");
    if (!focusHw) return pending.slice(0, 3);
    return pending.filter((t) => t.homework.id !== focusHw.id).slice(0, 3);
  }, [allTaskList, focusHw]);

  const stepTotal = focusHw?.steps?.length ?? 0;
  const stepIdx =
    focusHw && dashboard && user
      ? nextStepIndex(focusHw, dashboard, user)
      : 0;
  const stepTitle =
    focusHw?.steps?.slice().sort((a, b) => a.index - b.index)[stepIdx]
      ?.title ?? null;

  const doneSteps = useMemo(() => {
    if (!focusHw || !user) return 0;
    const own = (dashboard?.homework_attempts ?? []).filter(
      (a) =>
        a.homework_id === focusHw.id && a.student_id === user.student_id,
    );
    return new Set(own.filter((a) => a.completed_step).map((a) => a.step_index))
      .size;
  }, [focusHw, dashboard, user]);

  const barPct =
    stepTotal > 0
      ? Math.min(100, Math.round((doneSteps / stepTotal) * 100))
      : 0;

  const coachHint =
    weakness[0]
      ? `最近薄弱：${weakness[0]}。卡住时在练习台点「教练」，不用离开答题。`
      : mode === "empty"
        ? "老师发布作业后，我会陪你分步想清楚，而不是替你交卷。"
        : "讲清依据比背答案更重要；答得好，提示会更开放。";

  const greet =
    new Date().getHours() < 12
      ? "早上好"
      : new Date().getHours() < 18
        ? "下午好"
        : "晚上好";

  function handlePrimary() {
    if (mode === "empty") {
      onOpenTasks();
      return;
    }
    if (mode === "all_done") {
      onOpenAsk();
      return;
    }
    onContinue();
  }

  const primaryLabel =
    mode === "continue"
      ? "接着练"
      : mode === "start"
        ? "开始这一题"
        : mode === "all_done"
          ? "和教练复盘"
          : "看看任务";

  const title =
    mode === "continue" || mode === "start"
      ? (focusHw?.title ?? "开始练习")
      : mode === "all_done"
        ? "这轮练完了"
        : "还没有可练的作业";

  const subtitle =
    mode === "continue"
      ? stepTitle
        ? `停在第 ${stepIdx + 1}/${stepTotal || "?"} 步 · ${stepTitle}`
        : `停在第 ${stepIdx + 1} 步`
      : mode === "start"
        ? stepTotal > 0
          ? `${stepTotal} 个阶段 · ${focusCourseName ?? "当前课程"} · 我陪你分步想`
          : (focusCourseName ?? "点下方，我们一起开始")
        : mode === "all_done"
          ? "可以换一门课，或让教练帮你巩固薄弱点。"
          : "老师发布后会出现在这里；我在这儿等你。";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-14 pt-8 sm:px-8 sm:pt-10">
      {/* 页眉：轻，不抢主 CTA */}
      <header className="mb-8">
        <p className="text-sm text-muted-foreground sm:text-base">
          {greet}，{user?.name ?? "同学"}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            今天练什么
          </h1>
          <p className="text-sm text-muted-foreground">
            信任{" "}
            <strong className="tabular-nums text-trust">{trustScore}</strong>
            <span className="mx-1.5 text-border">·</span>
            {styleLabel}
          </p>
        </div>
      </header>

      {/* 课程过滤：紧凑 chip，不是大卡墙 */}
      {courses.length > 0 && (
        <section className="mb-6" data-tour="tour-courses" aria-label="筛选课程">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={!currentCourseId}
              onClick={() => onSelectCourse(null)}
            >
              全部
              {globalPending > 0 ? ` · ${globalPending}` : ""}
            </FilterChip>
            {courses.map((c: Course) => {
              const n = allTaskList.filter(
                (t) =>
                  t.homework.course_id === c.id && t.status !== "done",
              ).length;
              return (
                <FilterChip
                  key={c.id}
                  active={currentCourseId === c.id}
                  onClick={() => onSelectCourse(c.id)}
                >
                  {c.name}
                  {n > 0 ? ` · ${n}` : ""}
                </FilterChip>
              );
            })}
            <button
              type="button"
              onClick={onOpenCourses}
              className="rounded-full px-3 py-1.5 text-sm text-brand hover:underline"
            >
              更多
            </button>
          </div>
        </section>
      )}

      {/* 唯一主舞台 */}
      <motion.button
        type="button"
        data-tour="tour-home-card"
        onClick={handlePrimary}
        whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        className="stage-card group w-full p-7 text-left outline-none transition hover:shadow-[var(--shadow-float)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-9"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge mode={mode} />
          {focusCourseName && (
            <span className="text-sm text-muted-foreground">
              {focusCourseName}
            </span>
          )}
        </div>

        <h2
          data-tour="tour-continue"
          className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl sm:leading-snug"
        >
          {title}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {subtitle}
        </p>

        {(mode === "continue" || mode === "start") && stepTotal > 0 && (
          <div className="mt-6 max-w-sm">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>
                {doneSteps} / {stepTotal} 阶段
              </span>
              <span className="tabular-nums">{barPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        )}

        <span className="btn-brand mt-8 inline-flex gap-2 px-6 py-3 text-base">
          {primaryLabel}
          <ArrowRight
            size={18}
            className={
              reduceMotion
                ? ""
                : "transition-transform group-hover:translate-x-0.5"
            }
          />
        </span>
      </motion.button>

      {/* 下一项：最多 3 条，文案级，不复制导航 */}
      {nextTasks.length > 0 && (
        <section className="mt-10" aria-label="接下来">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">接下来</h3>
            <button
              type="button"
              data-tour="tour-task-list"
              onClick={onOpenTasks}
              className="text-sm text-brand hover:underline"
            >
              全部任务
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {nextTasks.map((t) => (
              <li key={t.homework.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask?.(t.homework.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-brand/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {t.homework.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {courses.find((c) => c.id === t.homework.course_id)
                        ?.name ?? "课程"}
                      <span className="mx-1">·</span>
                      {t.status === "in_progress" ? "进行中" : "未开始"}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 教练：一行，次要 */}
      <button
        type="button"
        onClick={onOpenAsk}
        className="mt-8 flex w-full items-start gap-3 rounded-2xl border border-transparent px-1 py-2 text-left transition hover:border-border hover:bg-card/80"
      >
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MessageCircle size={16} />
        </span>
        <span className="min-w-0">
          <span className="text-sm font-medium text-foreground">教练提示</span>
          <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
            {coachHint}
          </span>
        </span>
      </button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground"
          : "rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-brand/30 hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === "continue") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
        <Layers size={12} /> 进行中
      </span>
    );
  }
  if (mode === "start") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
        <Sparkles size={12} /> 待开始
      </span>
    );
  }
  if (mode === "all_done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 size={12} /> 已完成
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <BookOpen size={12} /> 暂无任务
    </span>
  );
}
