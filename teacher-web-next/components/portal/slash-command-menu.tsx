"use client";

import { useEffect, useRef } from "react";
import type { SlashCommand } from "@/lib/commands";

const GROUP_ORDER = ["名单", "教学", "资料", "报告", "系统"] as const;

/**
 * 斜杠命令浮层：贴在输入框上方。受控组件——
 * 由父级（AgentWorkbench）根据 textarea 是否以 / 开头决定 open，
 * 并把过滤后的 commands、当前高亮 index 传进来。
 */
export function SlashCommandMenu({
  open,
  commands,
  activeIndex,
  onPick,
  title = "可用指令",
}: {
  open: boolean;
  commands: SlashCommand[];
  activeIndex: number;
  onPick: (cmd: SlashCommand) => void;
  title?: string;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  // 按分组排序展示，但高亮 index 基于扁平顺序（与父级键盘导航一致）
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: commands.filter((c) => c.group === g),
  })).filter((x) => x.items.length > 0);

  // 建立 command.id → 扁平索引 的映射，保证高亮与父级 activeIndex 对齐
  const flatIndex = new Map<string, number>();
  commands.forEach((c, i) => flatIndex.set(c.id, i));

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
      <div className="sticky top-0 border-b border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
        {title}
        {commands.length === 0 && "（无匹配，按 Esc 关闭）"}
      </div>
      {grouped.map(({ group, items }) => (
        <div key={group} className="py-1">
          <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {group}
          </div>
          {items.map((cmd) => {
            const idx = flatIndex.get(cmd.id) ?? -1;
            const active = idx === activeIndex;
            return (
              <button
                key={cmd.id}
                ref={active ? activeRef : undefined}
                onMouseDown={(e) => {
                  // mousedown 而非 click：避免 textarea 先失焦导致的时序问题
                  e.preventDefault();
                  onPick(cmd);
                }}
                className={
                  active
                    ? "flex w-full items-center gap-3 bg-accent px-4 py-2 text-left text-accent-foreground"
                    : "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted"
                }
              >
                <code
                  className={
                    active
                      ? "shrink-0 rounded bg-accent-foreground/20 px-1.5 py-0.5 text-xs"
                      : "shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  /{cmd.trigger}
                </code>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {cmd.label}
                  </span>
                  <span
                    className={
                      active
                        ? "block truncate text-xs text-accent-foreground/80"
                        : "block truncate text-xs text-muted-foreground"
                    }
                  >
                    {cmd.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
