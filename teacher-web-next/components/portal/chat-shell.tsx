"use client";

import { LogOut, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { ConversationSummary } from "@/lib/types";
import { ProfileMenu } from "./profile-menu";
import { StatusLine } from "./ui";
import { AgentWorkbench } from "./agent-workbench";
import { ConversationList } from "./conversation-sidebar";
import { PanelDock } from "./panel-dock";
import {
  hasPanel,
  panelTitle,
  renderPanel,
  type OpenPanel,
  type PanelInstance,
} from "./panel-registry";

const roleName: Record<string, string> = {
  admin: "管理员",
  teacher: "教师",
  student: "学生",
};

/**
 * 对话为主的门户外壳：品牌侧栏 + 全屏 Agent 对话工作区 + 右侧按需抽屉。
 * 超管端与教师端共用，差异仅由 mode 决定。
 */
export function ChatShell({ mode }: { mode: "admin" | "teacher" }) {
  const { user, notice, error, logout } = useSession();
  const router = useRouter();

  // 面板栈：栈顶为当前可见面板，支持列表→详情的一层以上堆叠。
  const [panelStack, setPanelStack] = useState<PanelInstance[]>([]);
  const activePanel = panelStack[panelStack.length - 1] ?? null;

  const openPanel = useCallback<OpenPanel>((kind, props) => {
    if (!hasPanel(kind)) return;
    setPanelStack((prev) => [...prev, { kind, props }]);
  }, []);
  const closePanels = useCallback(() => setPanelStack([]), []);
  const popPanel = useCallback(
    () => setPanelStack((prev) => prev.slice(0, -1)),
    [],
  );

  const activeMeta = activePanel
    ? panelTitle(activePanel.kind)
    : { title: "", subtitle: undefined };

  // —— 对话历史侧栏状态 ——
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      /* 静默：侧栏为空不阻塞对话 */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
      } catch {
        /* 忽略删除错误 */
      }
      setActiveConversationId((cur) => (cur === id ? null : cur));
      await loadConversations();
    },
    [loadConversations],
  );

  // AgentWorkbench 自动保存后：同步高亮 id 并刷新列表。
  const handleConversationSaved = useCallback(
    (summary: ConversationSummary) => {
      setActiveConversationId((cur) => cur ?? summary.id);
      setConversations((prev) => {
        const without = prev.filter((c) => c.id !== summary.id);
        return [summary, ...without];
      });
    },
    [],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* 品牌侧栏 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/60 px-4 py-6 max-[900px]:hidden">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles size={18} />
          </span>
          <div className="leading-tight">
            <strong className="block text-sm font-semibold">云雀教学</strong>
            <span className="text-xs text-muted-foreground">
              {roleName[user?.role ?? ""] ?? user?.role}
            </span>
          </div>
        </div>

        {/* Claude 式历史对话列表 */}
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onNew={handleNewConversation}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />

        <div className="mt-4 border-t border-border pt-4">
          <strong className="block text-sm">
            {user?.name ?? user?.username}
          </strong>
          <span className="text-xs text-muted-foreground">
            {user?.username}
          </span>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      </aside>

      {/* 工作区：顶栏 + 状态条 + 全屏对话 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3.5">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {mode === "admin" ? "超管控制台" : "教师工作台"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "admin"
                ? "平台治理、名单与资料库 — 用对话完成"
                : "备课、发任务、看学情 — 用对话完成"}
            </p>
          </div>
          <ProfileMenu align="end" variant="portal" />
        </header>
        <StatusLine notice={notice} error={error} />
        <main className="min-h-0 flex-1 overflow-hidden">
          <AgentWorkbench
            mode={mode}
            openPanel={openPanel}
            conversationId={activeConversationId}
            onConversationSaved={handleConversationSaved}
          />
        </main>
      </div>

      {/* 右侧按需抽屉：栈顶面板可见，栈深 > 1 时可返回上一层 */}
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
    </div>
  );
}
