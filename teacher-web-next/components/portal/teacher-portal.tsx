"use client";

import {
  BookOpen,
  ClipboardList,
  Database,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import StaggeredText from "@/components/staggered-text";
import { AgentFloat } from "./agent-float";
import { ClassProfilePanel } from "./roster/class-profile-panel";
import {
  OnboardingBanner,
  OnboardingTrigger,
  setOnboardDismissed,
} from "./onboarding-banner";
import { EmptyState, PageIntro, primaryBtnCls } from "./page-kit";
import { PanelDock } from "./panel-dock";
import {
  panelTitle,
  renderPanel,
  type OpenPanel,
  type PanelInstance,
} from "./panel-registry";
import { type NavGroup, PortalShell, TaskList } from "./ui";
import { StudentListPanel } from "./roster/student-list-panel";
import { LessonLibrary } from "./lessons/lesson-library";
import { RagSearchPanel } from "./lessons/rag-search-panel";
import { useDemoMode } from "@/lib/demo-mode";

// React Bits 视觉组件：错落入场文字（更轻、更稳）
// const StaggeredText = dynamic(
//   () => import("@/components/staggered-text"),
//   { ssr: false },
// );

type TeacherView =
  | "overview"
  | "homework"
  | "materials"
  | "students"
  | "report";

const NAV_GROUPS: NavGroup[] = [
  {
    id: "g-home",
    label: "工作台",
    icon: <LayoutDashboard size={16} />,
    href: "overview",
  },
  {
    id: "g-teach",
    label: "教学",
    icon: <ClipboardList size={16} />,
    defaultOpen: true,
    children: [
      {
        id: "homework",
        label: "任务列表",
        icon: <ClipboardList size={15} />,
      },
      {
        id: "materials",
        label: "教案资料",
        icon: <Database size={15} />,
      },
    ],
  },
  {
    id: "g-class",
    label: "班级",
    icon: <GraduationCap size={16} />,
    defaultOpen: true,
    children: [
      {
        id: "students",
        label: "学生名单",
        icon: <GraduationCap size={15} />,
      },
      {
        id: "report",
        label: "班级学情",
        icon: <BookOpen size={15} />,
      },
    ],
  },
];

/**
 * 教师端：列表 / 概览为主页面；
 * 发布作业、导入资料等长表单进右侧抽屉（二级），不整页摊开。
 */
export function TeacherPortal() {
  const [view, setView] = useState<TeacherView>("overview");
  const [forceGuide, setForceGuide] = useState(false);
  const [panelStack, setPanelStack] = useState<PanelInstance[]>([]);
  const { dashboard } = useSession();
  const demo = useDemoMode();

  const activePanel = panelStack[panelStack.length - 1] ?? null;

  const openPanel = useCallback<OpenPanel>((kind, props) => {
    setPanelStack((prev) => {
      // 同类表单只保留一层，避免重复堆叠
      if (
        kind === "homework-form" ||
        kind === "materials-upload"
      ) {
        const without = prev.filter((p) => p.kind !== kind);
        return [...without, { kind, props }];
      }
      return [...prev, { kind, props }];
    });
  }, []);

  const closePanels = useCallback(() => setPanelStack([]), []);
  const popPanel = useCallback(
    () => setPanelStack((prev) => prev.slice(0, -1)),
    [],
  );

  const openHomeworkForm = useCallback(() => {
    openPanel("homework-form");
  }, [openPanel]);

  const openMaterialsUpload = useCallback(() => {
    openPanel("materials-upload");
  }, [openPanel]);

  function showGuide() {
    setOnboardDismissed("teacher", false);
    setForceGuide(true);
    setView("overview");
  }

  const navGroups = useMemo(() => {
    const publishedCount = (dashboard?.homeworks ?? []).filter(
      (h) => h.published && !h.archived,
    ).length;
    return NAV_GROUPS.map((g) => {
      if (g.id !== "g-teach") return g;
      return {
        ...g,
        children: g.children?.map((c) =>
          c.id === "homework"
            ? { ...c, badge: publishedCount || undefined }
            : c,
        ),
      };
    });
  }, [dashboard]);

  const allHw = (dashboard?.homeworks ?? []).filter((h) => !h.archived);
  const published = allHw.filter((h) => h.published);
  const drafts = allHw.filter((h) => !h.published);
  const hasHomework = published.length > 0;
  const hasLessons = (dashboard?.lessons?.length ?? 0) > 0;
  const hasStudents = (dashboard?.students?.length ?? 0) > 0;

  const meta: Record<TeacherView, { title: string; subtitle: string }> = {
    overview: {
      title: "教师工作台",
      subtitle: "列表浏览 · 表单在右侧抽屉完成",
    },
    homework: {
      title: "发布作业",
      subtitle: "先看任务列表，点「新建」在抽屉里填写",
    },
    materials: {
      title: "教案资料",
      subtitle: "资料库列表 · 导入在抽屉中完成",
    },
    students: {
      title: "学生名单",
      subtitle: "点学生查看学情详情",
    },
    report: {
      title: "班级学情",
      subtitle: "共性问题、均分与教学建议",
    },
  };

  let body: React.ReactNode;
  if (view === "overview") {
    body = (
      <div className="mx-auto flex w-full max-w-full flex-col gap-4 px-4 sm:max-w-3xl sm:gap-8 sm:px-6">
        <header>
          <p className="eyebrow">工作台</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            备课与布置
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            资料 {dashboard?.lessons?.length ?? 0}
            <span className="mx-1.5 text-border">·</span>
            已发布 {published.length}
            {drafts.length > 0 && (
              <>
                <span className="mx-1.5 text-border">·</span>
                草稿 {drafts.length}
              </>
            )}
            <span className="mx-1.5 text-border">·</span>
            学生 {dashboard?.students?.length ?? 0}
          </p>
          {/* 错落入场：把工作台核心信息做成视觉锚点 */}
          <div className="mt-3 max-w-2xl text-sm text-muted-foreground/90 sm:text-base">
            <StaggeredText
              text={`备课与布置 · ${dashboard?.lessons?.length ?? 0} 份教案 · 已发布 ${published.length}${drafts.length > 0 ? ` · 草稿 ${drafts.length}` : ""} · 学生 ${dashboard?.students?.length ?? 0} · 信任分门控 · 屏幕感知 · RAG 检索`}
              as="p"
              segmentBy="words"
              delay={24}
              duration={0.4}
              className="leading-relaxed"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryBtnCls + " gap-2 px-6 py-3 text-base"}
              onClick={openHomeworkForm}
            >
              <Plus size={18} />
              发布作业
            </button>
            <button
              type="button"
              className="btn-ghost gap-2 px-5 py-3 text-base"
              onClick={openMaterialsUpload}
            >
              <Upload size={16} />
              导入教案
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            表单在右侧抽屉打开，主界面保持列表清晰。
          </p>
        </header>

        {published.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="还没有已发布任务"
            desc="点「发布作业」在抽屉中填写；学生端「今日」会立刻出现。"
            action={
              <button
                type="button"
                className={primaryBtnCls}
                onClick={openHomeworkForm}
              >
                去发布第一份作业
              </button>
            }
          />
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-tight">
                已发布 · {published.length}
              </h3>
              <button
                type="button"
                className="text-sm font-medium text-brand hover:underline"
                onClick={() => setView("homework")}
              >
                管理全部
              </button>
            </div>
            <TaskList items={published} />
          </div>
        )}
      </div>
    );
  } else if (view === "homework") {
    body = (
      <div className="mx-auto w-full max-w-3xl">
        <PageIntro
          eyebrow="教学"
          title="任务列表"
          desc="浏览本班任务。新建或编辑走右侧抽屉，不占满主页面。"
          actions={
            <button
              type="button"
              className={primaryBtnCls + " gap-1.5"}
              onClick={openHomeworkForm}
            >
              <Plus size={16} />
              新建作业
            </button>
          }
        />
        {allHw.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={20} />}
            title="暂无任务"
            desc="点右上角「新建作业」，在抽屉里填标题与步骤后发布。"
            action={
              <button
                type="button"
                className={primaryBtnCls}
                onClick={openHomeworkForm}
              >
                新建作业
              </button>
            }
          />
        ) : (
          <TaskList items={allHw} />
        )}
      </div>
    );
  } else if (view === "materials") {
    body = (
      <div className="mx-auto w-full max-w-3xl">
        <PageIntro
          eyebrow="资料"
          title="教案资料库"
          desc="点开可看全文、编辑与归档。导入在抽屉中完成。"
          actions={
            <button
              type="button"
              className={primaryBtnCls + " gap-1.5"}
              onClick={openMaterialsUpload}
            >
              <Upload size={16} />
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
  } else if (view === "students") {
    body = (
      <div className="mx-auto w-full max-w-3xl">
        <PageIntro
          eyebrow="名单"
          title="学生名单"
          desc="点学生姓名，在右侧查看学情详情。"
        />
        <div
          data-lenis-prevent
          className="surface-card min-h-[320px] overflow-hidden"
        >
          <StudentListPanel openPanel={openPanel} />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="mx-auto w-full max-w-4xl">
        <PageIntro
          eyebrow="学情"
          title="班级学情"
          desc="共性问题与建议；点学生可下钻个人学情。"
        />
        <div
          data-lenis-prevent
          className="surface-card min-h-[320px] overflow-hidden"
        >
          <ClassProfilePanel openPanel={openPanel} />
        </div>
      </div>
    );
  }

  const dockMeta = activePanel
    ? panelTitle(activePanel.kind)
    : { title: "", subtitle: undefined as string | undefined };

  return (
    <>
      {!demo.hideChrome && (
        <OnboardingBanner
          id="teacher"
          title="教师上手"
          forceShow={forceGuide}
          onDismiss={() => setForceGuide(false)}
          onVisibilityChange={(v) => {
            if (!v) setForceGuide(false);
          }}
          steps={[
            {
              id: "materials",
              target: "materials",
              label: "导入教案",
              hint: "侧栏进资料库，点「导入资料」在抽屉上传。",
              done: hasLessons,
            },
            {
              id: "homework",
              target: "homework",
              label: "发布作业",
              hint: "任务列表点「新建作业」，表单在右侧抽屉。",
              done: hasHomework,
            },
            {
              id: "students",
              target: "students",
              label: "查看学生",
              hint: "点学生姓名看学情详情抽屉。",
              done: hasStudents,
            },
          ]}
          onStepClick={(id) => setView(id as TeacherView)}
        />
      )}
      <PortalShell
        title={meta[view].title}
        subtitle={meta[view].subtitle}
        groups={navGroups}
        active={view}
        onSelect={(id) => setView(id as TeacherView)}
        headerActions={
          demo.hideChrome ? undefined : <OnboardingTrigger onClick={showGuide} />
        }
        sidebarFooter={
          demo.hideChrome ? undefined : (
            <OnboardingTrigger onClick={showGuide} label="显示使用引导" />
          )
        }
        floating={
          <>
            {!demo.hideChrome && (
              <AgentFloat
                mode="teacher"
                onNavigate={(id) => {
                  const known: TeacherView[] = [
                    "overview",
                    "homework",
                    "materials",
                    "students",
                    "report",
                  ];
                  if (known.includes(id as TeacherView)) {
                    setView(id as TeacherView);
                  }
                }}
              />
            )}
            <PanelDock
              open={Boolean(activePanel)}
              title={dockMeta.title}
              subtitle={dockMeta.subtitle}
              canGoBack={panelStack.length > 1}
              onBack={popPanel}
              onClose={closePanels}
            >
              {activePanel
                ? renderPanel(activePanel.kind, {
                    mode: "teacher",
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
