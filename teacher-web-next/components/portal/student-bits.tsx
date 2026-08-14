"use client";

import { ArrowUp, Maximize2, Minimize2, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import type { ChatMessage, HomeworkAttempt } from "@/lib/types";

/** 等待流式首包时的打字点（三个跳动的小圆点） */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 py-1 ${className ?? ""}`}
      role="status"
      aria-label="正在输入"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

/** 流式输出中的打字光标 */
export function StreamCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[2px] animate-pulse rounded-full bg-brand"
    />
  );
}

/** 教练消息正文：等待首包=打字点；流式中=文字+光标；完成=纯文字 */
export function AssistantMessageBody({ message }: { message: ChatMessage }) {
  if (message.streaming && !message.content) {
    return <TypingDots />;
  }
  return (
    <div className="whitespace-pre-wrap">
      {message.content}
      {message.streaming && <StreamCursor />}
    </div>
  );
}

/** AI 头像气泡（左对齐） */
export function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed">
        {children}
      </div>
    </motion.div>
  );
}

/** 学生气泡（右对齐） */
export function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-brand-foreground">
        {children}
      </div>
    </motion.div>
  );
}

/** 一次提交 = 学生答案气泡 + AI 信任分反馈气泡 */
export function AttemptExchange({ attempt }: { attempt: HomeworkAttempt }) {
  return (
    <>
      <UserBubble>{attempt.answer}</UserBubble>
      <AssistantBubble>
        <div
          className={
            attempt.completed_step
              ? "rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4"
              : "rounded-xl border border-border bg-card p-4"
          }
        >
          <div className="mb-2 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-border bg-background leading-none">
              <strong className="text-base text-foreground">
                {attempt.trust_score}
              </strong>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                信任分
              </span>
            </span>
            <div>
              <span className="text-sm font-semibold">
                第 {attempt.step_index + 1} 阶段反馈
              </span>
              {attempt.completed_step && (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  已通过
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{attempt.guidance}</p>
        </div>
      </AssistantBubble>
    </>
  );
}

/**
 * 底部输入条。
 * immersive=true：Gemini 式大输入坞，可展开写作区。
 */
export function Composer({
  value,
  onChange,
  onSend,
  canSend,
  thinking,
  placeholder,
  hint,
  hintAction,
  immersive = false,
  expanded = false,
  onExpandedChange,
  textareaRef: externalRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  canSend: boolean;
  thinking: boolean;
  placeholder: string;
  hint?: React.ReactNode;
  hintAction?: React.ReactNode;
  immersive?: boolean;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? localRef;

  // 自适应高度（沉浸模式）
  useEffect(() => {
    if (!immersive) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = expanded ? 220 : 96;
    el.style.height = `${Math.min(max, Math.max(expanded ? 96 : 52, el.scrollHeight))}px`;
  }, [value, immersive, expanded, ref]);

  const shell = thinking
    ? "flex items-end gap-2 rounded-[1.35rem] border border-brand/30 bg-card p-2.5 shadow-[var(--shadow-card)] ring-1 ring-brand/15"
    : immersive
      ? "flex items-end gap-2 rounded-[1.35rem] border border-border bg-card p-2.5 shadow-[var(--shadow-float)] focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15"
      : "flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)] focus-within:border-brand/35 focus-within:ring-1 focus-within:ring-brand/15";

  return (
    <div className="mx-auto w-full max-w-2xl">
      {(hint || hintAction) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground sm:text-xs">
          <span className="min-w-0 flex-1">{hint}</span>
          {hintAction}
        </div>
      )}
      <div className={shell}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (immersive && onExpandedChange) onExpandedChange(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
            if (e.key === "Escape" && expanded && onExpandedChange) {
              onExpandedChange(false);
              ref.current?.blur();
            }
          }}
          rows={immersive ? (expanded ? 4 : 2) : 2}
          placeholder={placeholder}
          disabled={thinking}
          className={
            immersive
              ? "max-h-[220px] min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
              : "max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
          }
        />
        <div className="flex shrink-0 flex-col items-center gap-1 pb-0.5">
          {immersive && onExpandedChange && (
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? "收起输入" : "展开输入"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="发送"
            className={
              immersive
                ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            }
          >
            {thinking ? (
              <RefreshCw size={17} className="animate-spin" />
            ) : (
              <ArrowUp size={17} />
            )}
          </button>
        </div>
      </div>
      <p className="mt-1 px-1 text-center text-[10px] text-muted-foreground sm:text-[11px]">
        {thinking
          ? "教练正在看你的思路…"
          : immersive
            ? "Enter 发送 · Shift+Enter 换行 · Esc 收起"
            : "Enter 发送 · Shift+Enter 换行"}
      </p>
    </div>
  );
}
