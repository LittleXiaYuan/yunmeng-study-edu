"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Expand,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Transition,
} from "motion/react";
import { useSession } from "@/components/session-provider";
import { nextStepIndex } from "@/lib/portal-helpers";
import type {
  ChatMessage,
  HomeworkAttempt,
  HomeworkStep,
  HomeworkTask,
} from "@/lib/types";
import { CoachSheet } from "./coach-sheet";
import { Composer, TypingDots } from "./student-bits";

const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

const SWIPE_THRESHOLD = 70;
const SWIPE_VELOCITY = 450;

/**
 * Gemini 式一屏沉浸伴学：
 * - 视口内完整显示，不靠整页下拉
 * - 圆形步骤轨 + 3D 轮播题干
 * - 题干可放大阅读
 * - 底部大输入区，聚焦可展开
 * - 教练反馈贴输入上方，不抢舞台
 */
export function LearningFlow({
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
    messages,
    studentAnswer,
    setStudentAnswer,
    submitStudentHomework,
  } = useSession();
  const reduceMotion = useReducedMotion();

  const steps = useMemo<HomeworkStep[]>(
    () => (homework.steps ?? []).slice().sort((a, b) => a.index - b.index),
    [homework],
  );
  const hwAttempts = attempts.filter((a) => a.homework_id === homework.id);
  const currentIdx = nextStepIndex(homework, dashboard, user);
  const [focusIdx, setFocusIdx] = useState(currentIdx);
  const [coachOpen, setCoachOpen] = useState(false);
  const [celebrateBurst, setCelebrateBurst] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stageExpanded, setStageExpanded] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [trustPulse, setTrustPulse] = useState<{
    score: number;
    delta: number;
  } | null>(null);
  const prevAttemptId = useRef<string | null>(null);
  const prevTrust = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-220, 0, 220], [8, 0, -8]);
  const dragScale = useTransform(dragX, [-220, 0, 220], [0.97, 1, 0.97]);

  useEffect(() => setFocusIdx(currentIdx), [homework.id, currentIdx]);
  useEffect(() => {
    dragX.set(0);
  }, [focusIdx, dragX]);

  // 放大阅读时锁 body 滚轮感（本页已一屏，防穿透）
  useEffect(() => {
    if (!stageExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStageExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageExpanded]);

  const focusStep = steps[focusIdx];
  const isAnswerStep = focusIdx === currentIdx;
  const thinking = busy === "student-submit";
  const canSend = isAnswerStep && !!studentAnswer.trim() && !thinking;
  const latest = hwAttempts.slice(-1)[0];

  // 教练正在流式回复时，把增量内容同步预览到左侧面板
  const lastMsg = messages[messages.length - 1];
  const liveReply =
    busy === "chat" && lastMsg?.role === "assistant" ? lastMsg : null;

  useEffect(() => {
    if (!latest || thinking) return;
    if (prevAttemptId.current === latest.id) return;
    const prevId = prevAttemptId.current;
    prevAttemptId.current = latest.id;
    if (prevId === null && hwAttempts.length > 1) {
      prevTrust.current = latest.trust_score;
      return;
    }
    const prev = prevTrust.current;
    prevTrust.current = latest.trust_score;
    const timers: number[] = [];
    if (prev !== null && latest.trust_score !== prev) {
      setTrustPulse({
        score: latest.trust_score,
        delta: latest.trust_score - prev,
      });
      timers.push(window.setTimeout(() => setTrustPulse(null), 2800));
    }
    if (latest.completed_step && !reduceMotion) {
      setCelebrateBurst(true);
      timers.push(window.setTimeout(() => setCelebrateBurst(false), 4200));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [latest, thinking, reduceMotion, hwAttempts.length]);

  // 提交成功后收起展开输入
  useEffect(() => {
    if (!thinking && !studentAnswer) setInputExpanded(false);
  }, [thinking, studentAnswer]);

  const stepFeedback = hwAttempts
    .filter((a) => a.step_index === focusIdx)
    .slice()
    .reverse();
  const latestFeedback = stepFeedback[0];

  // 新反馈默认折叠两行；换反馈时重置
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  useEffect(() => setFeedbackExpanded(false), [latestFeedback?.id]);

  function stateOf(i: number): "done" | "current" | "locked" {
    const done = hwAttempts.some(
      (a) => a.step_index === i && a.completed_step,
    );
    if (done) return "done";
    if (i === currentIdx) return "current";
    return i < currentIdx ? "done" : "locked";
  }

  function goTo(i: number) {
    if (i < 0 || i >= steps.length || i === focusIdx) return;
    dragX.set(0);
    setFocusIdx(i);
  }
  function goPrev() {
    goTo(focusIdx - 1);
  }
  function goNext() {
    goTo(focusIdx + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stageExpanded || inputExpanded) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "TEXTAREA" ||
          t.tagName === "INPUT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(focusIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(focusIdx + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusIdx, steps.length, stageExpanded, inputExpanded]);

  function onDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    const { offset, velocity } = info;
    const go =
      offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY
        ? 1
        : offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY
          ? -1
          : 0;
    if (go === 1 && focusIdx < steps.length - 1) {
      goNext();
      return;
    }
    if (go === -1 && focusIdx > 0) {
      goPrev();
      return;
    }
    void animate(dragX, 0, { type: "spring", stiffness: 420, damping: 32 });
  }

  if (steps.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-6 text-center">
        <Lock size={28} className="text-brand/40" />
        <p className="text-base font-semibold">该任务暂无分步骤</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          请联系老师补充步骤后再练习。
        </p>
      </div>
    );
  }

  const spring: Transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 360, damping: 30, mass: 0.85 };

  const st = stateOf(focusIdx);
  const visible = [focusIdx - 1, focusIdx, focusIdx + 1].filter(
    (i) => i >= 0 && i < steps.length,
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      data-learning-flow="1"
    >
      {celebrateBurst && (
        <Confetti
          recycle={false}
          numberOfPieces={120}
          gravity={0.32}
          tweenDuration={3600}
          colors={["#1a73e8", "#0d9f6e", "#8ab4f8", "#fbbf24"]}
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-brand/[0.09] blur-3xl dark:bg-brand/14" />
      </div>

      {/* 顶条：紧凑 */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-4 pt-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted-foreground">
            {homework.title}
            <span className="mx-1.5 text-border">·</span>
            {focusIdx + 1}/{steps.length}
            {isAnswerStep ? " · 写下想法" : " · 回看"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStageExpanded(true)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            title="放大阅读"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">放大</span>
          </button>
          <button
            type="button"
            onClick={() => setCoachOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2.5 text-[11px] font-medium text-brand"
          >
            <MessageCircle size={13} />
            教练
          </button>
        </div>
      </div>

      {/* 宽屏两栏：左「教练动态」面板 / 右练习主区；窄屏只保留主区 */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <CoachPanel
          steps={steps}
          attempts={hwAttempts}
          focusStep={focusStep}
          grading={thinking}
          chatting={busy === "chat"}
          liveReply={liveReply}
          onAsk={() => setCoachOpen(true)}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {/* 圆形步骤轨：更紧 */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-center gap-1 px-3 py-2.5 sm:gap-1.5"
        role="list"
        aria-label="学习阶段"
      >
        {steps.map((s, i) => {
          const sState = stateOf(i);
          const active = focusIdx === i;
          return (
            <button
              key={s.index}
              type="button"
              role="listitem"
              onClick={() => goTo(i)}
              className="flex shrink-0 items-center gap-1 sm:gap-1.5"
              aria-current={active ? "step" : undefined}
              aria-label={`阶段 ${i + 1} ${s.title}`}
            >
              <motion.span
                layout={!reduceMotion}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: active ? 1.16 : 1,
                        boxShadow: active
                          ? "0 0 0 5px var(--brand-glow)"
                          : "0 0 0 0 transparent",
                      }
                }
                transition={spring}
                className={
                  active
                    ? "relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground"
                    : sState === "done"
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-success text-[11px] font-bold text-white"
                      : sState === "locked"
                        ? "flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-[11px] text-muted-foreground"
                        : "flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand/35 bg-card text-[11px] font-bold"
                }
              >
                {sState === "done" && !active ? (
                  <CheckCircle2 size={13} />
                ) : (
                  i + 1
                )}
              </motion.span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={
                    stateOf(i) === "done"
                      ? "h-0.5 w-5 rounded-full bg-success/70 sm:w-8"
                      : "h-0.5 w-5 rounded-full bg-border sm:w-8"
                  }
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 主舞台：吃掉剩余高度，内部不撑出整页滚动 */}
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 sm:px-5">
        <div
          className="relative mx-auto min-h-0 w-full max-w-xl flex-1"
          style={{ perspective: reduceMotion ? undefined : 1300 }}
        >
          <button
            type="button"
            onClick={goPrev}
            disabled={focusIdx === 0}
            className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded-full border border-border bg-card/95 p-2 text-foreground shadow-sm transition enabled:hover:bg-muted disabled:opacity-20 sm:-left-1"
            aria-label="上一阶段"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={focusIdx >= steps.length - 1}
            className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded-full border border-border bg-card/95 p-2 text-foreground shadow-sm transition enabled:hover:bg-muted disabled:opacity-20 sm:-right-1"
            aria-label="下一阶段"
          >
            <ChevronRight size={16} />
          </button>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            {visible.map((i) => {
              const offset = i - focusIdx;
              const sState = stateOf(i);
              const step = steps[i];
              const isCenter = offset === 0;
              const baseX = reduceMotion
                ? offset * 28
                : offset === 0
                  ? 0
                  : offset < 0
                    ? -108
                    : 108;
              const baseScale = isCenter ? 1 : reduceMotion ? 0.9 : 0.8;
              const baseRotateY = reduceMotion ? 0 : offset * -26;
              const baseOpacity = isCenter ? 1 : 0.42;

              return (
                <motion.div
                  key={`step-card-${step?.index ?? i}`}
                  role={isCenter ? "group" : "button"}
                  tabIndex={isCenter ? undefined : 0}
                  aria-label={
                    isCenter ? `当前阶段 ${i + 1}` : `查看阶段 ${i + 1}`
                  }
                  onClick={() => {
                    if (!isCenter) goTo(i);
                  }}
                  className={
                    isCenter
                      ? dragging
                        ? "absolute flex max-h-full w-[min(100%,24rem)] cursor-grabbing touch-pan-y outline-none"
                        : "absolute flex max-h-full w-[min(100%,24rem)] cursor-grab touch-pan-y outline-none"
                      : "absolute flex max-h-[86%] w-[min(78%,19rem)] cursor-pointer outline-none"
                  }
                  initial={false}
                  animate={
                    isCenter
                      ? {
                          x: 0,
                          scale: 1,
                          rotateY: 0,
                          opacity: 1,
                          z: 90,
                          filter: "blur(0px)",
                        }
                      : {
                          x: baseX,
                          scale: baseScale,
                          rotateY: baseRotateY,
                          opacity: baseOpacity,
                          z: 12,
                          filter: reduceMotion ? "none" : "blur(1px)",
                        }
                  }
                  transition={spring}
                  style={
                    isCenter && !reduceMotion
                      ? {
                          x: dragX,
                          rotateY: dragRotate,
                          scale: dragScale,
                          zIndex: 20,
                          transformStyle: "preserve-3d",
                        }
                      : {
                          zIndex: isCenter ? 20 : 10,
                          transformStyle: "preserve-3d",
                        }
                  }
                  drag={isCenter && !reduceMotion && !stageExpanded ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragMomentum={false}
                  onDragStart={() => isCenter && setDragging(true)}
                  onDragEnd={(e, info) => isCenter && onDragEnd(e, info)}
                >
                  <div
                    className={
                      isCenter
                        ? "flex max-h-full min-h-0 w-full flex-col"
                        : "pointer-events-none flex max-h-full min-h-0 w-full flex-col select-none"
                    }
                  >
                    <StepCard
                      index={i}
                      step={step}
                      state={sState}
                      active={isCenter}
                      onExpand={
                        isCenter ? () => setStageExpanded(true) : undefined
                      }
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 教练反馈（窄屏时贴输入上方；宽屏由左侧面板承担） */}
      <div className="relative z-20 mx-auto w-full max-w-2xl shrink-0 px-3 sm:px-5 xl:hidden">
        {thinking ? (
          <motion.div
            key="grading"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 rounded-2xl border border-brand/25 bg-card/90 px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-brand">
                {!reduceMotion && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand/15" />
                )}
                <Sparkles size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">教练正在批改这一步</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  对照阶段要求逐条看你的思路
                  <TypingDots />
                </p>
              </div>
            </div>
          </motion.div>
        ) : latestFeedback ? (
          <motion.div
            key={latestFeedback.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              latestFeedback.completed_step
                ? "mb-2 rounded-2xl border border-success/25 bg-success-soft/90 px-3 py-2.5"
                : "mb-2 rounded-2xl border border-border bg-card/90 px-3 py-2.5 shadow-sm"
            }
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full border border-border bg-background leading-none">
                <strong className="text-sm tabular-nums text-trust">
                  {latestFeedback.trust_score}
                </strong>
                <span className="text-[8px] text-muted-foreground">信任</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold">教练</span>
                  {latestFeedback.completed_step ? (
                    <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                      已通过
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      再补充
                    </span>
                  )}
                </div>
                <p
                  className={
                    feedbackExpanded
                      ? "whitespace-pre-wrap text-xs leading-relaxed text-foreground/85 sm:text-[13px]"
                      : "line-clamp-2 text-xs leading-relaxed text-foreground/85 sm:text-[13px]"
                  }
                >
                  {latestFeedback.guidance}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  {latestFeedback.guidance.length > 48 && (
                    <button
                      type="button"
                      onClick={() => setFeedbackExpanded((v) => !v)}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      {feedbackExpanded ? "收起" : "展开全文"}
                    </button>
                  )}
                  {latestFeedback.completed_step &&
                    focusIdx < steps.length - 1 && (
                      <button
                        type="button"
                        onClick={() => goTo(currentIdx)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        下一步 →
                      </button>
                    )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : isAnswerStep ? (
          <p className="mb-1.5 px-1 text-center text-[11px] text-muted-foreground">
            讲清依据 · 卡住了点教练 · 可左右滑切步
          </p>
        ) : null}
      </div>

      {/* Gemini 式底部输入坞 */}
      <div
        className={
          inputExpanded
            ? "relative z-30 shrink-0 border-t border-border bg-background px-3 pb-3 pt-2 sm:px-5"
            : "relative z-30 shrink-0 border-t border-border/80 bg-background/95 px-3 pb-2.5 pt-2 backdrop-blur-xl sm:px-5"
        }
      >
        {isAnswerStep ? (
          <Composer
            value={studentAnswer}
            onChange={setStudentAnswer}
            onSend={() => canSend && submitStudentHomework(homework)}
            canSend={canSend}
            thinking={thinking}
            immersive
            expanded={inputExpanded}
            onExpandedChange={setInputExpanded}
            textareaRef={composerRef}
            placeholder="写下你的理解… 讲清依据更重要"
            hint={
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate">
                  阶段 {focusIdx + 1} · {focusStep?.title}
                </span>
                <button
                  type="button"
                  onClick={() => setCoachOpen(true)}
                  className="shrink-0 text-brand underline-offset-2 hover:underline"
                >
                  问教练
                </button>
              </span>
            }
          />
        ) : (
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 py-2 text-xs text-muted-foreground">
            <Lock size={12} />
            {st === "locked" ? "此阶段尚未解锁" : "回看模式"}
            <button
              type="button"
              onClick={() => goTo(currentIdx)}
              className="btn-brand rounded-full px-3 py-1.5 text-xs"
            >
              回到答题
            </button>
          </div>
        )}
      </div>
        </div>
      </div>

      {/* 信任分轻提示 */}
      <AnimatePresence>
        {trustPulse && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            className="pointer-events-none fixed bottom-36 left-1/2 z-[55] -translate-x-1/2"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm shadow-[var(--shadow-float)]">
              {trustPulse.delta >= 0 ? (
                <TrendingUp size={14} className="text-success" />
              ) : (
                <TrendingDown size={14} className="text-muted-foreground" />
              )}
              <span>
                信任{" "}
                <strong className="tabular-nums text-trust">
                  {trustPulse.score}
                </strong>
              </span>
              <span
                className={
                  trustPulse.delta >= 0
                    ? "tabular-nums text-success"
                    : "tabular-nums text-muted-foreground"
                }
              >
                {trustPulse.delta > 0
                  ? `+${trustPulse.delta}`
                  : trustPulse.delta}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 放大阅读层 — Gemini 式专注阅读 */}
      <AnimatePresence>
        {stageExpanded && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col bg-background/95 backdrop-blur-md"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  阶段 {focusIdx + 1} / {steps.length}
                </p>
                <p className="truncate text-sm font-semibold">
                  {focusStep?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageExpanded(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm"
              >
                <Minimize2 size={15} />
                收起
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10">
              <div className="mx-auto max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {focusStep?.title}
                </h2>
                <p className="mt-6 text-base leading-[1.85] text-foreground/90 sm:text-lg">
                  {focusStep?.instruction || "完成该阶段要求。"}
                </p>
                {focusStep?.expected ? (
                  <div className="mt-8 rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      想清楚这些
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {focusStep.expected}
                    </p>
                  </div>
                ) : null}
                {isAnswerStep && (
                  <button
                    type="button"
                    onClick={() => {
                      setStageExpanded(false);
                      setInputExpanded(true);
                      window.setTimeout(
                        () => composerRef.current?.focus(),
                        80,
                      );
                    }}
                    className="btn-brand mt-10 w-full py-3 sm:w-auto sm:min-w-[200px]"
                  >
                    开始作答
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CoachSheet
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        contextHint={focusStep?.title}
        pageContext={
          focusStep
            ? {
                scene: "homework_step",
                title: homework.title,
                step_title: focusStep.title,
                step_index: focusIdx,
                step_total: steps.length,
                instruction: [
                  focusStep.instruction,
                  homework.prompt ? `总任务：${homework.prompt}` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
                expected_hint: focusStep.expected || "",
                student_draft: isAnswerStep ? studentAnswer : "",
                course_name:
                  dashboard?.courses?.find((c) => c.id === homework.course_id)
                    ?.name || "",
                homework_id: homework.id,
                lesson_id: homework.lesson_id || "",
                visible_summary: `作业《${homework.title}》第 ${focusIdx + 1}/${steps.length} 步：${focusStep.title}`,
              }
            : null
        }
      />
    </div>
  );
}

function StepCard({
  index,
  step,
  state,
  active,
  onExpand,
}: {
  index: number;
  step: HomeworkStep | undefined;
  state: "done" | "current" | "locked";
  active: boolean;
  onExpand?: () => void;
}) {
  return (
    <div
      className={
        state === "done"
          ? "stage-card flex max-h-full min-h-0 flex-col overflow-hidden border border-success/30 p-5 sm:p-6"
          : state === "current" && active
            ? "stage-card flex max-h-full min-h-0 flex-col overflow-hidden border border-brand/20 p-5 ring-1 ring-brand/10 sm:p-6"
            : "stage-card flex max-h-full min-h-0 flex-col overflow-hidden border border-border p-5 sm:p-6"
      }
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <span className="eyebrow inline-flex items-center gap-2">
          阶段 {index + 1}
          {state === "done" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-success">
              <CheckCircle2 size={11} /> 已通过
            </span>
          )}
          {state === "locked" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
              <Lock size={11} /> 未解锁
            </span>
          )}
          {state === "current" && active && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-brand">
              当前
            </span>
          )}
        </span>
        {active && onExpand ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="放大阅读"
          >
            <Expand size={15} />
          </button>
        ) : (
          <Sparkles size={16} className="text-brand/60" aria-hidden />
        )}
      </div>

      <h2 className="shrink-0 text-xl font-semibold tracking-tight sm:text-2xl sm:leading-snug">
        {step?.title || `步骤 ${index + 1}`}
      </h2>

      {active ? (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <p className="text-sm leading-[1.7] text-foreground/88 sm:text-[15px]">
            {step?.instruction || "完成该阶段要求。"}
          </p>
          {step?.expected ? (
            <div className="mt-3 rounded-xl bg-muted/70 px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                想清楚这些
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                {step.expected}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {step?.instruction || "…"}
        </p>
      )}
    </div>
  );
}

/** 左侧「教练动态」面板（宽屏专用）：实时状态 + 批改过程 + 历次反馈时间线 */
function CoachPanel({
  steps,
  attempts,
  focusStep,
  grading,
  chatting,
  liveReply,
  onAsk,
}: {
  steps: HomeworkStep[];
  attempts: HomeworkAttempt[];
  focusStep: HomeworkStep | undefined;
  grading: boolean;
  chatting: boolean;
  liveReply: ChatMessage | null;
  onAsk: () => void;
}) {
  const timeline = attempts.slice().reverse();
  return (
    <aside
      className="relative z-10 hidden w-[21.5rem] shrink-0 flex-col border-r border-border/60 bg-card/40 xl:flex 2xl:w-[24rem]"
      aria-label="教练动态"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
          {(grading || chatting) && (
            <span className="absolute inset-0 animate-ping rounded-full bg-brand/15" />
          )}
          <Sparkles size={14} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">教练</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {grading ? "批改中…" : chatting ? "回复中…" : "在旁边看你写"}
          </p>
        </div>
        <button
          type="button"
          onClick={onAsk}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-2.5 text-[11px] font-medium text-brand"
        >
          <MessageCircle size={12} />
          提问
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {grading ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-brand/25 bg-card px-3 py-3 shadow-sm"
          >
            <p className="mb-2 text-xs font-semibold">正在批改这一步</p>
            <GradingSteps stepTitle={focusStep?.title || "当前阶段"} />
          </motion.div>
        ) : chatting ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-brand/25 bg-card px-3 py-3 shadow-sm"
          >
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              正在回复你的提问
              <TypingDots />
            </p>
            {liveReply?.content ? (
              <p className="line-clamp-6 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
                {liveReply.content}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                对照你屏幕上的题干与草稿组织引导…
              </p>
            )}
          </motion.div>
        ) : (
          <div className="rounded-2xl bg-muted/40 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            我能看到你正在做「{focusStep?.title || "当前阶段"}
            」。写下想法后提交，我会逐条对照要求给反馈；卡住了点上面的「提问」。
          </div>
        )}

        {timeline.length > 0 && (
          <div>
            <p className="eyebrow mb-2 px-0.5">教练输出记录</p>
            <ol className="space-y-2">
              {timeline.map((a) => (
                <CoachTimelineItem
                  key={a.id}
                  attempt={a}
                  stepTitle={
                    steps[a.step_index]?.title || `阶段 ${a.step_index + 1}`
                  }
                />
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
}

/** 批改过程分步动画：定时推进，最后一步保持进行中直到结果返回（组件随 grading 卸载） */
function GradingSteps({ stepTitle }: { stepTitle: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [700, 1800, 3400].map((ms, i) =>
      window.setTimeout(() => setPhase(i + 1), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  const items = [
    "读取你的答案",
    `对照「${stepTitle}」的阶段要求`,
    "逐条核对关键点",
    "写反馈与评分",
  ];
  return (
    <ol className="space-y-1.5">
      {items.map((label, i) => (
        <li
          key={label}
          className={
            i <= phase
              ? "flex items-center gap-2 text-[12px] text-foreground/85"
              : "flex items-center gap-2 text-[12px] text-muted-foreground/50"
          }
        >
          {i < phase ? (
            <CheckCircle2 size={13} className="shrink-0 text-success" />
          ) : i === phase ? (
            <span className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            </span>
          ) : (
            <span className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
            </span>
          )}
          {label}
        </li>
      ))}
    </ol>
  );
}

/** 单条教练反馈（可展开全文） */
function CoachTimelineItem({
  attempt,
  stepTitle,
}: {
  attempt: HomeworkAttempt;
  stepTitle: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = (attempt.guidance || "").length > 64;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        attempt.completed_step
          ? "rounded-xl border border-success/25 bg-success-soft/60 px-3 py-2.5"
          : "rounded-xl border border-border bg-card px-3 py-2.5"
      }
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold">{stepTitle}</span>
        {attempt.completed_step ? (
          <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
            已通过
          </span>
        ) : (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            再补充
          </span>
        )}
        <span className="ml-auto text-[10px] tabular-nums text-trust">
          信任 {attempt.trust_score}
        </span>
      </div>
      <p
        className={
          expanded
            ? "whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80"
            : "line-clamp-3 text-[12px] leading-relaxed text-foreground/80"
        }
      >
        {attempt.guidance}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </motion.li>
  );
}
