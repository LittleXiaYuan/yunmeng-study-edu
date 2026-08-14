"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ConversationSummary } from "@/lib/types";

/**
 * Claude 式会话侧栏主体：「新对话」按钮 + 历史会话列表。
 * 受控组件——列表/当前选中/回调都由 ChatShell 提供。
 */
export function ConversationList({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        onClick={onNew}
        className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
      >
        <Plus size={15} />
        新对话
      </button>

      <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        历史对话
      </div>

      <div className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            还没有对话
            <br />
            发一条消息即可自动保存
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            const confirming = confirmingId === c.id;
            return (
              <div
                key={c.id}
                className={
                  active
                    ? "group flex items-center gap-1 rounded-lg bg-accent px-2 py-2 text-accent-foreground"
                    : "group flex items-center gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                }
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare
                    size={14}
                    className={active ? "shrink-0" : "shrink-0 opacity-60"}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.title || "未命名对话"}
                  </span>
                </button>

                {confirming ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        onDelete(c.id);
                        setConfirmingId(null);
                      }}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-300"
                    >
                      删除
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className={
                        active
                          ? "rounded px-1.5 py-0.5 text-[11px] text-accent-foreground/80"
                          : "rounded px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      }
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingId(c.id)}
                    aria-label="删除对话"
                    title="删除对话"
                    className={
                      active
                        ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-accent-foreground/70 hover:text-accent-foreground"
                        : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
