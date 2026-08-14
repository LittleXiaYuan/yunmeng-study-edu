"use client";

import { ChevronLeft, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * 右侧抽屉容器（对话为主 + 面板为辅 的“辅”）。
 *
 * 纯 CSS transform + 遮罩，不引入新 UI 库。支持一层以上的堆叠：
 * ChatShell 维护 panelStack，栈顶为当前可见面板，栈深 > 1 时展示“返回”。
 * 视觉沿用 directive-renderer 的 token（border/bg-card/text-muted-foreground）。
 */
export function PanelDock({
  open,
  title,
  subtitle,
  canGoBack,
  onBack,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  canGoBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  // Esc 关闭（仅在打开时挂载监听）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (canGoBack && onBack) onBack();
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canGoBack, onBack, onClose]);

  return (
    <>
      {/* 遮罩：点击关闭整个抽屉栈 */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={
          open
            ? "fixed inset-0 z-30 bg-black/30 opacity-100 transition-opacity duration-200"
            : "pointer-events-none fixed inset-0 z-30 bg-black/30 opacity-0 transition-opacity duration-200"
        }
      />
      {/* 抽屉本体 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={
          "fixed inset-y-0 right-0 z-40 flex w-[min(560px,92vw)] flex-col border-l border-border bg-card shadow-[var(--shadow-float)] transition-transform duration-200 ease-out " +
          (open ? "translate-x-0" : "pointer-events-none translate-x-full")
        }
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="返回上一层"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭面板"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </header>
        <div
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        >
          {children}
        </div>
      </aside>
    </>
  );
}
