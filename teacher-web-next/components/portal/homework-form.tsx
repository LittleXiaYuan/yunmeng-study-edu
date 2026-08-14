"use client";

import { ClipboardList, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useSession } from "@/components/session-provider";
import { Callout, fieldCls, primaryBtnCls } from "./page-kit";
import { Panel } from "./ui";

const STEP_TEMPLATES = [
  {
    label: "三步练习",
    steps: [
      {
        title: "解释概念",
        instruction: "用自己的话解释本题涉及的核心概念。",
        expected: "能准确说出定义，并指出与相邻概念的区别。",
      },
      {
        title: "举例应用",
        instruction: "给出一个具体例子，说明该概念如何使用。",
        expected: "例子完整、与概念对应，无明显事实错误。",
      },
      {
        title: "反思总结",
        instruction: "写下你仍不确定的地方，或易混淆的点。",
        expected: "能指出至少一处难点或易错点。",
      },
    ],
  },
  {
    label: "SQL 练习",
    steps: [
      {
        title: "写查询",
        instruction: "根据题意写出 SQL 语句。",
        expected: "语法正确，结果符合题意。",
      },
      {
        title: "说明思路",
        instruction: "简述为何这样写（用到的子句/连接）。",
        expected: "能说清过滤、连接与聚合逻辑。",
      },
    ],
  },
];

/**
 * 教师布置作业表单。
 * - 默认整页 Panel 壳
 * - embed：抽屉内嵌，无外层 Panel 标题（标题由 PanelDock 提供）
 * - onDone：发布/保存成功后回调（用于关抽屉）
 */
export function HomeworkForm({
  compact,
  embed,
  onDone,
}: {
  compact?: boolean;
  embed?: boolean;
  onDone?: () => void;
}) {
  const {
    dashboard,
    homeworkDraft,
    setHomeworkDraft,
    createHomeworkTask,
    busy,
  } = useSession();

  const classes = (dashboard?.classes ?? []).filter((c) => !c.archived);
  const courses = useMemo(
    () =>
      (dashboard?.courses ?? []).filter(
        (c) =>
          !c.archived &&
          (!homeworkDraft.class_id || c.class_id === homeworkDraft.class_id),
      ),
    [dashboard, homeworkDraft.class_id],
  );
  const lessons = useMemo(
    () =>
      (dashboard?.lessons ?? []).filter(
        (l) =>
          !l.archived &&
          (!homeworkDraft.course_id || l.course_id === homeworkDraft.course_id),
      ),
    [dashboard, homeworkDraft.course_id],
  );

  function addStep() {
    setHomeworkDraft({
      ...homeworkDraft,
      steps: [
        ...homeworkDraft.steps,
        { title: "", instruction: "", expected: "" },
      ],
    });
  }

  function applyTemplate(steps: typeof STEP_TEMPLATES[0]["steps"]) {
    setHomeworkDraft({ ...homeworkDraft, steps: steps.map((s) => ({ ...s })) });
  }

  function updateStep(
    index: number,
    field: "title" | "instruction" | "expected",
    value: string,
  ) {
    const steps = homeworkDraft.steps.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    );
    setHomeworkDraft({ ...homeworkDraft, steps });
  }

  function removeStep(index: number) {
    setHomeworkDraft({
      ...homeworkDraft,
      steps: homeworkDraft.steps.filter((_, i) => i !== index),
    });
  }

  const canSubmit =
    homeworkDraft.title.trim().length > 0 && homeworkDraft.class_id.length > 0;

  const form = (
      <div className={embed ? "flex flex-col gap-4 p-5 sm:p-6" : "flex flex-col gap-4"}>
        {!compact && !embed && (
          <Callout tone="tip" title="怎么发得更快？">
            先选班级 → 填标题 → 用下方模板生成步骤 → 按需修改 → 发布。
            也可用右下角 Agent 先出草稿，再粘贴到这里确认。
          </Callout>
        )}
        {embed && (
          <p className="text-sm text-muted-foreground">
            标题与班级必填。步骤可空（将使用默认三步）。签发权在老师。
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            任务标题 *
          </span>
          <input
            className={fieldCls}
            value={homeworkDraft.title}
            onChange={(e) =>
              setHomeworkDraft({ ...homeworkDraft, title: e.target.value })
            }
            placeholder="例如：E-R 图设计练习"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            总体说明（可选）
          </span>
          <textarea
            className={`${fieldCls} min-h-[88px] resize-y`}
            value={homeworkDraft.prompt}
            onChange={(e) =>
              setHomeworkDraft({ ...homeworkDraft, prompt: e.target.value })
            }
            placeholder="任务背景、提交要求、评分说明…"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              班级 *
            </span>
            <select
              className={fieldCls}
              value={homeworkDraft.class_id}
              onChange={(e) =>
                setHomeworkDraft({
                  ...homeworkDraft,
                  class_id: e.target.value,
                  course_id: "",
                })
              }
            >
              <option value="">选择班级</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              课程（可选）
            </span>
            <select
              className={fieldCls}
              value={homeworkDraft.course_id}
              onChange={(e) =>
                setHomeworkDraft({
                  ...homeworkDraft,
                  course_id: e.target.value,
                  lesson_id: "",
                })
              }
            >
              <option value="">不限课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              关联教案（可选）
            </span>
            <select
              className={fieldCls}
              value={homeworkDraft.lesson_id}
              onChange={(e) =>
                setHomeworkDraft({
                  ...homeworkDraft,
                  lesson_id: e.target.value,
                })
              }
            >
              <option value="">不关联</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              分步骤
              {homeworkDraft.steps.length > 0
                ? ` · ${homeworkDraft.steps.length} 步`
                : " · 空则用默认三步"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STEP_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t.steps)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand"
                >
                  <Sparkles size={11} />
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus size={11} />
                添加
              </button>
            </div>
          </div>

          {homeworkDraft.steps.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              暂无自定义步骤。可点「三步练习」快速填充，或发布时使用系统默认。
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {homeworkDraft.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                      第 {i + 1} 步
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      aria-label="删除该步骤"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <input
                    className={fieldCls}
                    value={step.title}
                    onChange={(e) => updateStep(i, "title", e.target.value)}
                    placeholder="步骤标题"
                  />
                  <textarea
                    className={`${fieldCls} min-h-[56px] resize-y`}
                    value={step.instruction}
                    onChange={(e) =>
                      updateStep(i, "instruction", e.target.value)
                    }
                    placeholder="学生需要做什么"
                  />
                  <textarea
                    className={`${fieldCls} min-h-[56px] resize-y`}
                    value={step.expected}
                    onChange={(e) => updateStep(i, "expected", e.target.value)}
                    placeholder="怎样算通过（可选）"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={homeworkDraft.published}
            onChange={(e) =>
              setHomeworkDraft({
                ...homeworkDraft,
                published: e.target.checked,
              })
            }
          />
          立即发布到学生端（不勾选则保存为草稿）
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            className={primaryBtnCls}
            onClick={() => createHomeworkTask(onDone)}
            disabled={!canSubmit || busy === "homework-create"}
          >
            <ClipboardList size={16} />
            {busy === "homework-create"
              ? "提交中…"
              : homeworkDraft.published
                ? "确认发布"
                : "保存草稿"}
          </button>
          {onDone && (
            <button type="button" className="btn-ghost" onClick={onDone}>
              取消
            </button>
          )}
          {!canSubmit && (
            <span className="self-center text-xs text-muted-foreground">
              请先填写标题并选择班级
            </span>
          )}
        </div>
      </div>
  );

  if (embed) return form;

  return (
    <Panel
      icon={<ClipboardList size={18} />}
      title="布置任务"
      desc="标题与班级必填；步骤可空（将使用默认三步模板）。签发权在老师。"
    >
      {form}
    </Panel>
  );
}
