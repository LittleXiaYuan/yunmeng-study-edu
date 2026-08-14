"use client";

import { MessageCircle, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AgentWorkbench } from "./agent-workbench";
import { PanelDock } from "./panel-dock";
import {
  hasPanel,
  panelTitle,
  renderPanel,
  type OpenPanel,
  type PanelInstance,
} from "./panel-registry";

/**
 * Agent 悬浮窗：不占主界面，右下角球 + 抽屉。
 * 主路径仍是侧栏业务页；对话只做加速（草稿、解释、快捷操作）。
 */
export function AgentFloat({
  mode,
  onNavigate,
}: {
  mode: "admin" | "teacher";
  /** 当 Agent 打开业务面板时，可同步切到对应主菜单 */
  onNavigate?: (viewId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelStack, setPanelStack] = useState<PanelInstance[]>([]);
  const activePanel = panelStack[panelStack.length - 1] ?? null;

  const openPanel = useCallback<OpenPanel>(
    (kind, props) => {
      if (!hasPanel(kind)) return;
      // 系统配置 / 名单等 → 尽量落到主界面，少嵌套
      const navMap: Record<string, string> = {
        "llm-config": "settings",
        overview: "overview",
        "student-list": "people",
        "student-import": "people",
        "class-profile": "report",
      };
      const view = navMap[kind];
      if (view && onNavigate) {
        onNavigate(view);
      }
      setPanelStack((prev) => [...prev, { kind, props }]);
      setOpen(true);
    },
    [onNavigate],
  );

  const closePanels = useCallback(() => setPanelStack([]), []);
  const popPanel = useCallback(
    () => setPanelStack((prev) => prev.slice(0, -1)),
    [],
  );

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePanel) closePanels();
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activePanel, closePanels]);

  const activeMeta = activePanel
    ? panelTitle(activePanel.kind)
    : { title: "", subtitle: undefined };

  return (
    <>
      {/* 悬浮球 + 文案，降低「找不到入口」成本 */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开教学 Agent"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand py-3 pl-3.5 pr-4 text-brand-foreground shadow-lg shadow-brand/25 transition hover:scale-[1.02] hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[480px]:h-14 max-[480px]:w-14 max-[480px]:justify-center max-[480px]:p-0"
        >
          <Sparkles size={20} />
          <span className="text-sm font-medium max-[480px]:hidden">
            教学 Agent
          </span>
        </button>
      )}

      {/* 对话抽屉 */}
      {open && (
        <div
          data-lenis-prevent
          className="fixed bottom-0 right-0 z-40 flex h-[min(720px,85vh)] w-full max-w-md flex-col overflow-hidden rounded-tl-2xl border border-border bg-background shadow-2xl max-[480px]:h-[90vh] max-[480px]:max-w-none max-[480px]:rounded-none"
          role="dialog"
          aria-label="教学 Agent 助手"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <MessageCircle size={16} />
              </span>
              <div className="leading-tight">
                <strong className="block text-sm font-semibold">
                  教学 Agent
                </strong>
                <span className="text-[11px] text-muted-foreground">
                  草稿与建议 · 主操作请在左侧页面完成
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                closePanels();
                setOpen(false);
              }}
              aria-label="关闭"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </header>
          <div data-lenis-prevent className="min-h-0 flex-1 overflow-hidden">
            <AgentWorkbench mode={mode} openPanel={openPanel} />
          </div>
        </div>
      )}

      {/* Agent 触发的业务面板仍用右侧 Dock，叠在悬浮窗之上 */}
      <PanelDock
        open={activePanel !== null}
        title={activeMeta.title}
        subtitle={activeMeta.subtitle}
        canGoBack={panelStack.length > 1}
        onBack={popPanel}
        onClose={closePanels}
      >
        {activePanel &&
          renderPanel(activePanel.kind, {
            mode,
            props: activePanel.props,
            openPanel,
            close: closePanels,
          })}
      </PanelDock>
    </>
  );
}
