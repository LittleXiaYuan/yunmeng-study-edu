"use client";

import { Eye, MessageCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSession } from "@/components/session-provider";
import type { PageContext } from "@/lib/types";
import { AssistantBubble, AssistantMessageBody, Composer, UserBubble } from "./student-bits";

/**
 * 沉浸式伴学：答题台内的教练浮层。
 * 注入 pageContext 后，教练能“看见”当前题干与草稿（Chrome Gemini 感）。
 */
export function CoachSheet({
  open,
  onClose,
  contextHint,
  pageContext,
}: {
  open: boolean;
  onClose: () => void;
  /** 当前阶段提示，帮助学生提问 */
  contextHint?: string;
  /** 完整屏幕上下文；发送时带给后端 */
  pageContext?: PageContext | null;
}) {
  const reduceMotion = useReducedMotion();
  const {
    busy,
    input,
    setInput,
    sendAgentMessage,
    messages,
    setPageContext,
  } = useSession();
  const thinking = busy === "chat";
  const canSend = !!input.trim() && !thinking;
  const scrollRef = useRef<HTMLDivElement>(null);

  // 打开时同步全局 pageContext，关闭时不强制清空（避免其它入口误伤）
  useEffect(() => {
    if (!open) return;
    if (pageContext) setPageContext(pageContext);
  }, [open, pageContext, setPageContext]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    // 流式输出时内容在原消息上增长，需依赖整个 messages 数组跟随滚动
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const seeing =
    pageContext?.step_title ||
    pageContext?.title ||
    contextHint ||
    "";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="关闭教练"
            className="fixed inset-0 z-[60] border-0 bg-black/35 backdrop-blur-[2px]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="学习教练"
            initial={
              reduceMotion
                ? false
                : { y: "100%", opacity: 0.9 }
            }
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: "40%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[min(78dvh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card shadow-[var(--shadow-float)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[min(72dvh,560px)] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-border">
              <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-border" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <MessageCircle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">学习教练</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    陪你想清楚 · 不直接给答案
                    {seeing ? ` · ${seeing}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="关闭"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>
              {seeing && (
                <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-soft/40 px-3 py-2">
                  <Eye size={14} className="mt-0.5 shrink-0 text-brand" />
                  <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-brand">正在看你的屏幕 · </span>
                    {pageContext?.instruction
                      ? pageContext.instruction.slice(0, 120) +
                        (pageContext.instruction.length > 120 ? "…" : "")
                      : seeing}
                    {pageContext?.student_draft?.trim() ? (
                      <span className="mt-1 block text-foreground/80">
                        草稿：{pageContext.student_draft.slice(0, 80)}
                        {pageContext.student_draft.length > 80 ? "…" : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    {seeing
                      ? `我能看到你正在做「${seeing}」。用问题帮你推进，不替你交卷。`
                      : "卡在这一步了？我用问题帮你推进，不替你交卷。"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "这一步该怎么想？",
                      "和上一步有什么关系？",
                      "我草稿写得对吗？",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setInput(q);
                        }}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:border-brand/40 hover:text-brand"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id}>{m.content}</UserBubble>
                ) : (
                  <AssistantBubble key={m.id}>
                    <AssistantMessageBody message={m} />
                  </AssistantBubble>
                ),
              )}
            </div>

            <div className="shrink-0 border-t border-border px-3 py-3">
              <Composer
                value={input}
                onChange={setInput}
                onSend={() =>
                  canSend && sendAgentMessage(pageContext ?? null)
                }
                canSend={canSend}
                thinking={thinking}
                placeholder="问教练：结合这道题我该怎么想？"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
