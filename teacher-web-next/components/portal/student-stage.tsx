"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useSession } from "@/components/session-provider";
import StaggeredText from "@/components/staggered-text";
import { nextStepIndex } from "@/lib/portal-helpers";
import type { HomeworkAttempt, HomeworkStep, HomeworkTask } from "@/lib/types";
import { AttemptExchange, Composer } from "./student-bits";

const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

/** 三阶段任务视图（走 submit）。 */
export function StudentStage({
  homework,
  attempts,
}: {
  homework: HomeworkTask;
  attempts: HomeworkAttempt[];
}) {
  const {
    user,
    dashboard,
    busy,
    studentAnswer,
    setStudentAnswer,
    submitStudentHomework,
  } = useSession();

  const steps = useMemo<HomeworkStep[]>(
    () => (homework.steps ?? []).slice().sort((a, b) => a.index - b.index),
    [homework],
  );
  const hwAttempts = attempts.filter((a) => a.homework_id === homework.id);
  const stepIdx = nextStepIndex(homework, dashboard, user);
  const currentStep = steps[stepIdx] ?? steps[0];

  const [selectedIdx, setSelectedIdx] = useState(currentStep?.index ?? 1);
  useEffect(() => {
    if (currentStep) setSelectedIdx(currentStep.index);
  }, [homework.id, currentStep?.index]);
  const selectedStep = steps.find((s) => s.index === selectedIdx) || currentStep;

  const latest = hwAttempts.slice(-1)[0];
  const showConfetti = latest?.completed_step && busy !== "student-submit";
  const thinking = busy === "student-submit";
  const canSend = !!studentAnswer.trim() && !thinking;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={380}
          gravity={0.3}
          tweenDuration={6000}
          colors={["#6366f1", "#7c83fc", "#34d399", "#f472b6", "#fbbf24"]}
          style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}
        />
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* hero */}
          <section className="text-center">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {homework.title}
            </span>
            <StaggeredText
              as="h1"
              text={`${user?.name || "同学"}，开始分阶段设计`}
              className="mt-1 text-3xl font-semibold tracking-tight"
              segmentBy="words"
              delay={60}
              direction="bottom"
              blur
            />
          </section>

          {/* 阶段 tab 条 */}
          <div className="flex flex-wrap justify-center gap-2" role="tablist">
            {steps.map((step, i) => {
              const selected = selectedIdx === step.index;
              const done = hwAttempts.some(
                (a) => a.step_index + 1 === step.index && a.completed_step,
              );
              return (
                <button
                  key={step.index}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedIdx(step.index)}
                  className={
                    selected
                      ? "inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
                  }
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    {done ? <CheckCircle2 size={14} /> : i + 1}
                  </span>
                  {step.title}
                </button>
              );
            })}
          </div>

          {/* 当前阶段说明卡 */}
          {selectedStep && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">
                    当前阶段 · {selectedStep.title}
                  </span>
                  <h2 className="mt-1 text-lg font-semibold">
                    {selectedStep.instruction}
                  </h2>
                </div>
                <Sparkles size={22} className="shrink-0 text-accent" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                先写你的理解，不必一次写成标准答案。提交后 Agent 会评分并给出下一步。
              </p>
            </section>
          )}

          {/* 反馈列表 */}
          {hwAttempts.length === 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <h2 className="text-sm font-semibold text-foreground">
                等待第一次提交
              </h2>
              <p className="mt-1">
                写出你的判断，Agent 会从可信度、知识点覆盖和规范性三方面反馈。
              </p>
            </section>
          ) : (
            hwAttempts.map((a) => <AttemptExchange key={a.id} attempt={a} />)
          )}
        </div>
      </div>

      {/* 底部答题栏（流内，shrink-0） */}
      <div className="shrink-0 border-t border-border bg-background/80 px-6 py-4 backdrop-blur">
        <Composer
          value={studentAnswer}
          onChange={setStudentAnswer}
          onSend={() => canSend && submitStudentHomework(homework)}
          canSend={canSend}
          thinking={thinking}
          placeholder={`写下「${currentStep?.title || "当前阶段"}」的答案…`}
          hint={
            currentStep ? (
              <>正在回答：阶段 {stepIdx + 1} · {currentStep.title}</>
            ) : null
          }
        />
      </div>
    </div>
  );
}
