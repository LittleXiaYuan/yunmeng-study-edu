"use client";

import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";import { useSession } from "@/components/session-provider";
import StaggeredText from "@/components/staggered-text";
import { AssistantBubble, AssistantMessageBody, Composer, UserBubble } from "./student-bits";

const AIBlob = dynamic(() => import("@/components/ai-blob"), { ssr: false });
// 与品牌令牌一致的冷蓝系（非随机紫）
const BLOB_COLORS = [
  "#1a73e8",
  "#4285f4",
  "#8ab4f8",
  "#aecbfa",
];

/**
 * 伴学对话场景（走 chat）。
 * companion=true：更像「回到练习」的轻量教练页，而不是独立产品频道。
 */
export function AskScene({
  companion = false,
  onBack,
}: {
  companion?: boolean;
  onBack?: () => void;
} = {}) {
  const {
    user,
    dashboard,
    busy,
    input,
    setInput,
    sendAgentMessage,
    messages,
    setPageContext,
  } = useSession();
  const thinking = busy === "chat";
  const canSend = !!input.trim() && !thinking;
  const empty = messages.length === 0;

  // 自由问答场景：注入轻量上下文（当前课程），让教练不“空聊”
  useEffect(() => {
    const course = (dashboard?.courses ?? []).find((c) => !c.archived);
    setPageContext(
      course
        ? {
            scene: "free_chat",
            course_name: course.name,
            visible_summary: `学生正在「云元伴学」自由问答，当前课程：${course.name}`,
          }
        : null,
    );
    return () => setPageContext(null);
  }, [dashboard, setPageContext]);

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
      placeholder="问教练：这一步我该怎么想？"
    />
  );

  const backBar =
    companion && onBack ? (
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          回到练习
        </button>
        <span className="text-[11px] text-muted-foreground">
          只引导提问 · 不直接给答案
        </span>
      </div>
    ) : null;

  if (empty) {
    return (
      <div className="flex min-h-[70vh] flex-col">
        {backBar}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="pointer-events-none relative mb-6 h-40 w-40 overflow-hidden sm:h-48 sm:w-48">
            <AIBlob
              size={192}
              resolution={1}
              animationSpeed={thinking ? 1.4 : 0.45}
              glowIntensity={0.75}
              colors={BLOB_COLORS}
              className="absolute inset-0"
            />
          </div>
          <StaggeredText
            as="h1"
            text={
              companion
                ? `${user?.name || "同学"}，卡住了就说`
                : `${user?.name || "同学"}，我在听`
            }
            className="text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            segmentBy="chars"
            delay={40}
            direction="bottom"
            blur
          />
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            {companion
              ? "我用问题陪你推进：可以说「这一步该怎么想」「和上一步有什么关系」。讲清依据比背答案更重要。"
              : "不会直接给标准答案。可以说：这一步该怎么想、从哪里入手。"}
          </p>
          <div className="relative z-30 mt-8 w-full">{composer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      {backBar}
      <div ref={scrollRef} className="flex-1 px-6 pt-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-4">
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
      <div className="relative z-30 shrink-0 border-t border-border bg-background/85 px-4 py-3 backdrop-blur">
        {composer}
      </div>
    </div>
  );
}
