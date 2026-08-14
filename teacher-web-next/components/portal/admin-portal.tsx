"use client";

import {
  BookOpen,
  ClipboardList,
  Database,
  Settings,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import { AgentFloat } from "./agent-float";
import { LLMConfigPanel } from "./llm-config-panel";
import {
  OnboardingBanner,
  OnboardingTrigger,
  setOnboardDismissed,
} from "./onboarding-banner";
import { Callout, PageIntro, StatusBadge } from "./page-kit";
import { PanelDock } from "./panel-dock";
import {
  panelTitle,
  renderPanel,
  type OpenPanel,
  type PanelInstance,
} from "./panel-registry";
import { StudentImportPanel } from "./roster/student-import-panel";
import { StudentListPanel } from "./roster/student-list-panel";
import { type NavGroup, PortalShell, Segmented } from "./ui";
import { LessonLibrary } from "./lessons/lesson-library";
import { RagSearchPanel } from "./lessons/rag-search-panel";
import { OverviewView, PeopleOpsView } from "./views";

type AdminView =
  | "overview"
  | "people"
  | "materials"
  | "settings"
  | "classes";

const NAV_GROUPS: NavGroup[] = [
  {
    id: "g-home",
    label: "总览",
    icon: <ClipboardList size={16} />,
    href: "overview",
  },
  {
    id: "g-org",
    label: "组织",
    icon: <Users size={16} />,
    defaultOpen: true,
    children: [
      { id: "people", label: "人员名单", icon: <Users size={15} /> },
      { id: "classes", label: "班级课程", icon: <BookOpen size={15} /> },
    ],
  },
  {
    id: "g-content",
    label: "内容",
    icon: <Database size={16} />,
    defaultOpen: true,
    children: [
      { id: "materials", label: "资料导入", icon: <Database size={15} /> },
    ],
  },
  {
    id: "g-sys",
    label: "系统",
    icon: <Settings size={16} />,
    defaultOpen: true,
    children: [
      { id: "settings", label: "大模型配置", icon: <Settings size={15} /> },
    ],
  },
];

/** 超管：管理系统为主 + Agent 悬浮窗。 */
export function AdminPortal() {
  const [view, setView] = useState<AdminView>("overview");
  const [peopleTab, setPeopleTab] = useState<"list" | "import">("list");
  const [forceGuide, setForceGuide] = useState(false);
  const [panelStack, setPanelStack] = useState<PanelInstance[]>([]);
  const { dashboard, llmConfig } = useSession();

  const activePanel = panelStack[panelStack.length - 1] ?? null;
  const openPanel = useCallback<OpenPanel>((kind, props) => {
    if (kind === "student-import") {
      setPeopleTab("import");
      setView("people");
      return;
    }
    if (kind === "student-list") {
      setPeopleTab("list");
      setView("people");
      return;
    }
    setPanelStack((prev) => [...prev, { kind, props }]);
  }, []);
  const closePanels = useCallback(() => setPanelStack([]), []);
  const popPanel = useCallback(
    () => setPanelStack((prev) => prev.slice(0, -1)),
    [],
  );

  function showGuide() {
    setOnboardDismissed("admin", false);
    setForceGuide(true);
    setView("overview");
  }

  const navGroups = useMemo(() => NAV_GROUPS, []);

  const meta: Record<AdminView, { title: string; subtitle: string }> = {
    overview: {
      title: "平台总览",
      subtitle: "人员、资料与任务一览；关键配置走侧栏，Agent 在右下角辅助",
    },
    people: {
      title: "人员名单",
      subtitle: "搜索、编辑与批量导入；导入结果可在表格中修改后再确认",
    },
    classes: {
      title: "班级与课程",
      subtitle: "维护班级、课程归属，决定资料与任务的可见范围",
    },
    materials: {
      title: "资料导入",
      subtitle: "上传教案 PDF / ZIP，写入检索索引",
    },
    settings: {
      title: "系统配置",
      subtitle: "配置 DeepSeek 等 OpenAI 兼容大模型网关",
    },
  };

  const hasStudents = (dashboard?.students?.length ?? 0) > 0;
  const hasLessons = (dashboard?.lessons?.length ?? 0) > 0;
  const llmOk = Boolean(
    llmConfig.enabled && llmConfig.base_url?.trim() && llmConfig.model?.trim(),
  );

  let body: React.ReactNode;
  if (view === "overview") {
    // 平台就绪：主 CTA 按缺口切换，不堆三列快捷卡
    const primary = !llmOk
      ? {
          label: "配置大模型",
          desc: "DeepSeek 等 OpenAI 兼容网关，填地址与 Key。",
          go: () => setView("settings"),
        }
      : !hasStudents
        ? {
            label: "导入学生名单",
            desc: "粘贴名单 → 表格确认 → 学生可登录。",
            go: () => {
              setPeopleTab("import");
              setView("people");
            },
          }
        : {
            label: "导入教案资料",
            desc: "PDF / ZIP 写入检索，供教练引用。",
            go: () => setView("materials"),
          };

    body = (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="eyebrow">平台总览</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {llmOk && hasStudents && hasLessons
              ? "平台已就绪"
              : "先完成关键配置"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            <StatusBadge tone={llmOk ? "ok" : "warn"}>
              {llmOk ? "LLM 已就绪" : "LLM 未配置"}
            </StatusBadge>
            <span className="mx-2 text-border">·</span>
            学生 {dashboard?.students?.length ?? 0}
            <span className="mx-2 text-border">·</span>
            资料 {dashboard?.lessons?.length ?? 0}
          </p>
          <button
            type="button"
            className="btn-brand mt-6 gap-2 px-6 py-3 text-base"
            onClick={primary.go}
          >
            {primary.label}
          </button>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            {primary.desc}
          </p>
        </header>

        <OverviewView role="admin" />
      </div>
    );
  } else if (view === "people") {
    body = (
      <>
        <PageIntro
          eyebrow="人员"
          title="学生名单与导入"
          desc="列表可搜索分页；批量导入支持可编辑预览，避免「生成后改不了」。"
          actions={
            <Segmented
              options={[
                { key: "list", label: "学生列表" },
                { key: "import", label: "批量导入" },
              ]}
              value={peopleTab}
              onChange={setPeopleTab}
            />
          }
        />
        <div
          data-lenis-prevent
          className="surface-card min-h-[320px] overflow-hidden"
        >
          {peopleTab === "list" ? (
            <StudentListPanel openPanel={openPanel} />
          ) : (
            <StudentImportPanel openPanel={openPanel} />
          )}
        </div>
      </>
    );
  } else if (view === "classes") {
    body = (
      <>
        <PageIntro
          eyebrow="组织"
          title="班级与课程"
          desc="先建班级，再建课程并关联班级；学生导入时要选对班级。"
        />
        <PeopleOpsView />
      </>
    );
  } else if (view === "materials") {
    body = (
      <div className="mx-auto w-full max-w-3xl">
        <PageIntro
          eyebrow="资料"
          title="教案资料库"
          desc="查看全文、编辑、归档；导入走抽屉。"
          actions={
            <button
              type="button"
              className="btn-brand gap-1.5"
              onClick={() => openPanel("materials-upload")}
            >
              导入资料
            </button>
          }
        />
        <div className="flex flex-col gap-5">
          <div className="surface-card overflow-hidden">
            <LessonLibrary openPanel={openPanel} />
          </div>
          <RagSearchPanel />
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <PageIntro
          eyebrow="系统"
          title="大模型配置"
          desc="保存后立即生效。教师端对话、学生端教练都依赖此处。"
        />
        {!llmOk && (
          <div className="mb-4">
            <Callout tone="warn" title="当前 LLM 未就绪">
              未启用或未填完整时，系统会用规则兜底，对话质量会明显下降。
              可点「DeepSeek」预设后只补 Key。
            </Callout>
          </div>
        )}
        <div className="surface-card mx-auto max-w-xl overflow-hidden">
          <LLMConfigPanel />
        </div>
      </>
    );
  }

  return (
    <>
      <OnboardingBanner
        id="admin"
        title="平台上手"
        forceShow={forceGuide}
        onDismiss={() => setForceGuide(false)}
        onVisibilityChange={(v) => {
          if (!v) setForceGuide(false);
        }}
        steps={[
          {
            id: "settings",
            target: "settings",
            label: "配置大模型",
            hint: "打开系统配置，选 DeepSeek 预设并填入 API Key。",
            done: llmOk,
          },
          {
            id: "people",
            target: "people",
            label: "导入学生名单",
            hint: "在人员名单里批量导入，表格确认后再生效。",
            done: hasStudents,
          },
          {
            id: "materials",
            target: "materials",
            label: "上传教案资料",
            hint: "资料导入支持 PDF / ZIP，会写入检索索引。",
            done: hasLessons,
          },
        ]}
        onStepClick={(id) => setView(id as AdminView)}
      />
      <PortalShell
        title={meta[view].title}
        subtitle={meta[view].subtitle}
        groups={navGroups}
        active={view}
        onSelect={(id) => setView(id as AdminView)}
        headerActions={<OnboardingTrigger onClick={showGuide} />}
        sidebarFooter={
          <OnboardingTrigger onClick={showGuide} label="显示使用引导" />
        }
        floating={
          <>
            <AgentFloat
              mode="admin"
              onNavigate={(id) => {
                const known: AdminView[] = [
                  "overview",
                  "people",
                  "classes",
                  "materials",
                  "settings",
                ];
                if (known.includes(id as AdminView)) {
                  setView(id as AdminView);
                }
              }}
            />
            <PanelDock
              open={Boolean(activePanel)}
              title={
                activePanel ? panelTitle(activePanel.kind).title : ""
              }
              subtitle={
                activePanel
                  ? panelTitle(activePanel.kind).subtitle
                  : undefined
              }
              canGoBack={panelStack.length > 1}
              onBack={popPanel}
              onClose={closePanels}
            >
              {activePanel
                ? renderPanel(activePanel.kind, {
                    mode: "admin",
                    props: activePanel.props,
                    openPanel,
                    close: closePanels,
                  })
                : null}
            </PanelDock>
          </>
        }
      >
        {body}
      </PortalShell>
    </>
  );
}
