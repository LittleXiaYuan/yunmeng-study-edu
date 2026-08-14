"use client";

import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ListChecks,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useSession } from "@/components/session-provider";
import {
  studentTaskList,
  type StudentTaskStatus,
} from "@/lib/portal-helpers";
import { EmptyState, PageIntro } from "./page-kit";

const STATUS_LABEL: Record<StudentTaskStatus, string> = {
  done: "已完成",
  in_progress: "进行中",
  not_started: "未开始",
};

const STATUS_ICON: Record<StudentTaskStatus, React.ReactNode> = {
  done: <CheckCircle2 size={18} className="text-success" />,
  in_progress: <CircleDashed size={18} className="text-brand" />,
  not_started: (
    <CircleDashed size={18} className="text-muted-foreground" />
  ),
};

/** 我的任务：全部作业清单；与「今日」待办预览互补。 */
export function TasksScene({
  onSelect,
}: {
  onSelect: (homeworkId: string) => void;
}) {
  const { dashboard, user } = useSession();
  const tasks = useMemo(
    () => studentTaskList(dashboard, user),
    [dashboard, user],
  );

  const pending = tasks.filter((t) => t.status !== "done").length;

  if (tasks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <PageIntro
          eyebrow="任务"
          title="我的任务"
          desc="老师发布的分步作业会出现在这里。"
        />
        <EmptyState
          icon={<ListChecks size={22} />}
          title="暂无发布任务"
          desc="老师发布后会出现在这里；也可先回「今日」看看课程。"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 pb-12 sm:px-8">
      <PageIntro
        eyebrow="任务"
        title="我的任务"
        desc={
          pending > 0
            ? `共 ${tasks.length} 份 · ${pending} 项待完成`
            : `共 ${tasks.length} 份 · 全部完成`
        }
      />
      <div className="flex flex-col gap-3">
        {tasks.map(({ homework, status }, i) => (
          <motion.article
            key={homework.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.03 }}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(homework.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(homework.id);
              }
            }}
            className={
              status === "done"
                ? "surface-card flex cursor-pointer items-center gap-4 p-5 transition hover:border-success/40"
                : "surface-card flex cursor-pointer items-center gap-4 p-5 transition hover:border-brand/35 hover:shadow-[var(--shadow-float)]"
            }
          >
            <span
              className={
                status === "in_progress"
                  ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"
                  : status === "done"
                    ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success-soft text-success"
                    : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              }
            >
              {STATUS_ICON[status]}
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-base font-semibold">
                {homework.title}
              </strong>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {STATUS_LABEL[status]} · {(homework.steps || []).length} 阶段
              </span>
            </div>
            <ChevronRight
              size={18}
              className="shrink-0 text-muted-foreground"
            />
          </motion.article>
        ))}
      </div>
    </div>
  );
}
