"use client";

import {
  AlertCircle,
  BadgeInfo,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AgentCard, AgentChoice, AgentDirective } from "@/lib/types";
import { StreamCursor, TypingDots } from "./student-bits";

const CARD_ICON: Record<string, ReactNode> = {
  info: <BadgeInfo size={16} />,
  form_prefill: <ClipboardList size={16} />,
  data: <BarChart3 size={16} />,
  analysis: <BarChart3 size={16} />,
  confirm: <AlertCircle size={16} />,
};

const CHOICE_STYLE: Record<string, string> = {
  primary:
    "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90",
  secondary:
    "inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  danger:
    "inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-300",
};

export function DirectiveCard({ card }: { card: AgentCard }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground">
          {CARD_ICON[card.type] ?? <BadgeInfo size={16} />}
        </span>
        <h4 className="text-sm font-semibold">{card.title}</h4>
      </div>
      {card.body && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {card.body}
        </p>
      )}
      {card.fields && Object.keys(card.fields).length > 0 && (
        <dl className="mt-2 flex flex-col gap-1">
          {Object.entries(card.fields).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-medium">{value || "（待填写）"}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.items && card.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {card.items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="flex items-start gap-1.5 text-xs text-foreground/85"
            >
              <CheckCircle2
                size={12}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {card.metrics && card.metrics.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {card.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg bg-muted/60 px-2 py-1.5 text-center"
            >
              <div className="text-sm font-semibold">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectiveChoices({
  choices,
  onChoice,
  disabled,
}: {
  choices: AgentChoice[];
  onChoice: (choice: AgentChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice, i) => (
        <button
          key={`${choice.label}-${i}`}
          onClick={() => onChoice(choice)}
          disabled={disabled}
          className={
            (CHOICE_STYLE[choice.style ?? "secondary"] ??
              CHOICE_STYLE.secondary) + " disabled:opacity-60"
          }
        >
          {choice.action === "dismiss" && <X size={13} />}
          {choice.label}
        </button>
      ))}
    </div>
  );
}

export function DirectiveBubble({
  directive,
  onChoice,
  disabled,
  dismissed,
  streaming,
}: {
  directive: AgentDirective;
  onChoice: (choice: AgentChoice) => void;
  disabled?: boolean;
  /** 已取消：收起卡片与操作按钮，仅保留回复文本并淡化。 */
  dismissed?: boolean;
  /** 正在生成中：reply 为空时显示打字点，有文字时附光标。 */
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (!directive.reply) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(directive.reply)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          /* ignore */
        });
    }
  }
  const showTypingDots = streaming && !directive.reply;
  const showCursor = Boolean(streaming && directive.reply);
  return (
    <div className="flex flex-col gap-3">
      {(directive.reply || showTypingDots) && (
        <div
          className={
            dismissed
              ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground"
              : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-2.5 text-sm"
          }
        >
          {showTypingDots ? (
            <TypingDots />
          ) : (
            <div className="whitespace-pre-wrap">
              {directive.reply}
              {showCursor && <StreamCursor />}
            </div>
          )}
          {dismissed && (
            <span className="ml-1.5 text-xs text-muted-foreground">· 已取消</span>
          )}
          {directive.reply && !dismissed && !streaming && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? "已复制" : "复制回复"}
              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </div>
      )}
      {!dismissed && directive.cards && directive.cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {directive.cards.map((card, i) => (
            <DirectiveCard key={`${card.title}-${i}`} card={card} />
          ))}
        </div>
      )}
      {!dismissed && directive.choices && directive.choices.length > 0 && (
        <DirectiveChoices
          choices={directive.choices}
          onChoice={onChoice}
          disabled={disabled}
        />
      )}
      {directive.llm_status === "disabled" && (
        <div
          role="status"
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground"
        >
          <BadgeInfo size={12} />
          LLM 未启用，当前为规则引擎回复
        </div>
      )}
      {(directive.llm_status === "error" ||
        directive.llm_status === "fallback") && (
        <div
          role="alert"
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-[11px] text-danger"
        >
          <AlertCircle size={12} />
          {directive.llm_status === "error"
            ? "模型调用失败，已使用规则兜底"
            : "模型暂不可用，已使用启发式规则回复"}
        </div>
      )}
    </div>
  );
}
