"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useSession } from "@/components/session-provider";
import StaggeredText from "@/components/staggered-text";
import { AssistantBubble, AssistantMessageBody, Composer, UserBubble } from "./student-bits";

const AIBlob = dynamic(() => import("@/components/ai-blob"), { ssr: false });

const BLOB_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#22d3ee"];

/** Agent 引导视图（走 chat）。空态用 AI Blob 大化身。 */
export function StudentChat() {
  const { user, busy, input, setInput, sendAgentMessage, messages } =
    useSession();

  const thinking = busy === "chat";
  const canSend = !!input.trim() && !thinking;
  const empty = messages.length === 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    // 流式输出时内容在原消息上增长，需依赖整个 messages 数组跟随滚动
  }, [messages, busy]);

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSend={() => canSend && sendAgentMessage()}
      canSend={canSend}
      thinking={thinking}
      placeholder="问学习教练：这一步我该怎么想？"
    />
  );

  if (empty) {
    // ===== 空态：AI Blob 大化身（Gemini 感） =====
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-4 h-[280px] w-[280px]">
          <AIBlob
            size={280}
            resolution={1}
            animationSpeed={thinking ? 1.8 : 0.5}
            glowIntensity={thinking ? 1 : 0.85}
            noiseScale={3}
            colors={BLOB_COLORS}
            className="absolute inset-0"
          />
        </div>
        <StaggeredText
          as="h1"
          text={`${user?.name || "同学"}，我在听`}
          className="text-center text-4xl font-semibold tracking-tight"
          segmentBy="chars"
          delay={45}
          direction="bottom"
          blur
        />
        <p className="mt-3 text-center text-sm text-muted-foreground">
          遇到卡点就问我：这一步该怎么想、从哪里入手。
        </p>
        <div className="mt-8 w-full">{composer}</div>
      </div>
    );
  }

  // ===== 对话态 =====
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 顶部：小化身思考灯（用 lucide，避免小 blob 毛边） */}
      <div className="flex items-center gap-3 px-6 py-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
          <span
            className={
              thinking
                ? "absolute inset-0 animate-ping rounded-full bg-accent/20"
                : ""
            }
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z" />
          </svg>
        </span>
        <span className="text-xs text-muted-foreground">
          {thinking ? "正在思考…" : "学习教练在线"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
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
      </div>

      <div className="shrink-0 border-t border-border bg-background/80 px-6 py-4 backdrop-blur">
        {composer}
      </div>
    </div>
  );
}
