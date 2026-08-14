import type {
  Dashboard,
  HomeworkAttempt,
  HomeworkTask,
  User,
} from "./types";

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function roleName(role: string): string {
  return (
    ({ admin: "管理员", teacher: "教师", student: "学生" } as Record<
      string,
      string
    >)[role] || role
  );
}

export function currentCourse(dashboard: Dashboard | null) {
  return (
    dashboard?.courses?.find((c) => !c.archived) || dashboard?.courses?.[0]
  );
}

export function currentStudent(dashboard: Dashboard | null) {
  return (
    dashboard?.students?.find((s) => !s.archived) || dashboard?.students?.[0]
  );
}

export function latestLesson(dashboard: Dashboard | null) {
  const lessons = dashboard?.lessons?.filter((l) => !l.archived) || [];
  return lessons[lessons.length - 1];
}

export function studentAttempts(
  dashboard: Dashboard | null,
  user: User | null,
) {
  return (dashboard?.homework_attempts || [])
    .filter((a) => a.student_id === user?.student_id)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function studentActiveHomework(
  dashboard: Dashboard | null,
  user: User | null,
  courseId?: string,
) {
  const attempts = studentAttempts(dashboard, user);
  const completed = new Set(
    attempts.filter((a) => a.completed_homework).map((a) => a.homework_id),
  );
  // courseId 传入时只在该课程范围内挑作业（学生端「选课」后按课筛选）
  const inScope = (h: HomeworkTask) =>
    h.published && !h.archived && (!courseId || h.course_id === courseId);
  return (
    (dashboard?.homeworks || []).filter(
      (h) => inScope(h) && !completed.has(h.id),
    )[0] || (dashboard?.homeworks || []).find(inScope)
  );
}

export type StudentTaskStatus = "done" | "in_progress" | "not_started";

export interface StudentTask {
  homework: HomeworkTask;
  status: StudentTaskStatus;
}

/** 学生可见的全部已发布任务及各自完成状态，供「我的任务」列表使用。 */
export function studentTaskList(
  dashboard: Dashboard | null,
  user: User | null,
): StudentTask[] {
  const attempts = studentAttempts(dashboard, user);
  return (dashboard?.homeworks || [])
    .filter((h) => h.published && !h.archived)
    .map((homework) => {
      const hwAttempts = attempts.filter((a) => a.homework_id === homework.id);
      let status: StudentTaskStatus = "not_started";
      if (hwAttempts.some((a) => a.completed_homework)) status = "done";
      else if (hwAttempts.length > 0) status = "in_progress";
      return { homework, status };
    })
    .reverse();
}

export function nextStepIndex(
  homework: HomeworkTask,
  dashboard: Dashboard | null,
  user: User | null,
): number {
  const ownAttempts = (dashboard?.homework_attempts || [])
    .filter(
      (a) => a.homework_id === homework.id && a.student_id === user?.student_id,
    )
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = ownAttempts[ownAttempts.length - 1];
  if (!last) return 0;
  if (last.completed_homework) return last.step_index;
  return Math.min(
    last.completed_step ? last.step_index + 1 : last.step_index,
    Math.max((homework.steps?.length || 1) - 1, 0),
  );
}

export interface StudentProfileStats {
  score: number;
  completed: number;
  revisions: number;
  style: string;
  focus: string[];
  bars: [string, number][];
  understandingScore: number;
  reflectionLevel: number;
  weakness: string[];
  commonErrors: string[];
  hasMemory: boolean;
}

/** 认知记忆 thinking_style 后端枚举 → 中文标签。 */
export function thinkingStyleLabel(style: string | undefined): string {
  return (
    ({
      reflective: "反思型",
      analytical: "分析型",
      surface: "表层型",
      unknown: "待观察",
    } as Record<string, string>)[style || "unknown"] || "待观察"
  );
}

/** 学习画像统计（信任分/通过阶段/迭代/学习风格/能力条），供画像页与通关页复用。有真实认知记忆时优先使用，否则回退按答题记录推导。 */
export function studentProfileStats(
  attempts: HomeworkAttempt[],
  dashboard: Dashboard | null,
): StudentProfileStats {
  const memory = dashboard?.student_memory;
  const hasMemory = Boolean(memory);

  const recent = attempts.slice(-6);
  const fallbackScore = recent.length
    ? Math.round(recent.reduce((s, a) => s + a.trust_score, 0) / recent.length)
    : Math.round(dashboard?.average_trust || 72);
  const score = memory ? memory.trust_score : fallbackScore;

  const completed = attempts.filter((a) => a.completed_step).length;
  const revisions = attempts.filter(
    (a) => a.next_required_action === "revise_current_step",
  ).length;

  const understandingScore = memory
    ? memory.understanding_score
    : Math.max(50, Math.min(95, score));
  const reflectionLevel = memory ? memory.reflection_level : 0;

  const style = memory
    ? thinkingStyleLabel(memory.thinking_style)
    : score >= 82
      ? "稳定推进型"
      : score >= 65
        ? "结构化拆解型"
        : "需要提示型";

  const fallbackFocus =
    revisions > 0
      ? ["补充推导依据", "细化知识关联", "检查规范与边界"]
      : ["识别核心概念", "归类相似结构", "判断逻辑联系"];
  const weakness =
    memory && memory.knowledge_weakness.length > 0
      ? memory.knowledge_weakness
      : fallbackFocus;
  const commonErrors = memory?.common_errors || [];

  const bars: [string, number][] = memory
    ? [
        ["目标拆解", Math.max(0, Math.min(100, understandingScore))],
        ["逻辑梳理", Math.max(0, Math.min(100, score))],
        ["规范落地", Math.max(0, Math.min(100, reflectionLevel))],
      ]
    : [
        ["目标拆解", Math.max(68, Math.min(96, score + 8))],
        ["逻辑梳理", Math.max(56, Math.min(92, score))],
        ["规范落地", Math.max(50, Math.min(88, score - 6))],
      ];

  return {
    score,
    completed,
    revisions,
    style,
    focus: weakness,
    bars,
    understandingScore,
    reflectionLevel,
    weakness,
    commonErrors,
    hasMemory,
  };
}
