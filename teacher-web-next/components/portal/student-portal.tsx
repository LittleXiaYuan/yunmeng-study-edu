"use client";

import {
  Code2,
  GraduationCap,
  Layers,
  ListChecks,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSession } from "@/components/session-provider";
import {
  studentActiveHomework,
  studentAttempts,
  studentProfileStats,
  studentTaskList,
} from "@/lib/portal-helpers";
import { LearningFlow } from "./learning-flow";
import { HomeContinueScene } from "./home-continue-scene";
import { AskScene } from "./ask-scene";
import { CodeReviewScene } from "./code-review-scene";
import { ProfileScene } from "./profile-scene";
import { CoursesScene } from "./courses-scene";
import { CelebrateScene } from "./celebrate-scene";
import { TasksScene } from "./tasks-scene";
import { ProfileMenu } from "./profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  OnboardingBanner,
  OnboardingTrigger,
  isOnboardDismissed,
  setOnboardDismissed,
} from "./onboarding-banner";
import { useDemoMode } from "@/lib/demo-mode";

type Scene = "home" | "flow" | "ask" | "code" | "profile" | "courses" | "tasks";

/**
 * 学生端 = 沉浸式伴学（不是教师工作台）。
 * 有可练任务时默认进专注台；练习中收起主导航，只留轻顶栏。
 */
export function StudentPortal() {
  const [scene, setScene] = useState<Scene>("flow");
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(
    null,
  );
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [forceGuide, setForceGuide] = useState(false);
  const [booted, setBooted] = useState(false);
  const scrollRef = useRef<HTMLElement | null>(null);
  const { user, dashboard, notice, error, refresh } = useSession();
  const demo = useDemoMode();

  function showGuide() {
    setOnboardDismissed("student", false);
    setForceGuide(true);
    // 引导高亮在「今日」+ 主导航上，不进练习台（避免收起导航后找不到目标）
    setScene("home");
  }

  const handleTourStep = useCallback((stepId: string) => {
    // 只切到仍显示完整导航的场景，保证 data-tour 可见
    if (stepId === "home" || stepId === "flow") setScene("home");
    else if (stepId === "tasks") setScene("home");
    else if (stepId === "profile") setScene("home");
  }, []);

  // 切换场景时滚回顶部；并挂捕获阶段 wheel 兜底（防外部 preventDefault）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [scene]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // 已在可编辑控件内则不拦截
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "TEXTAREA" ||
          t.tagName === "INPUT" ||
          t.isContentEditable)
      ) {
        return;
      }
      // 始终把滚轮应用到主滚动容器
      if (el.scrollHeight > el.clientHeight + 1) {
        e.preventDefault();
        el.scrollTop += e.deltaY;
      }
    };

    // 捕获 + 非 passive，确保能滚
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  const currentCourse = useMemo(
    () =>
      (dashboard?.courses ?? []).find((c) => c.id === currentCourseId) ?? null,
    [dashboard, currentCourseId],
  );

  const attempts = useMemo(
    () => studentAttempts(dashboard, user),
    [dashboard, user],
  );
  const autoHomework = useMemo(
    () => studentActiveHomework(dashboard, user, currentCourseId ?? undefined),
    [dashboard, user, currentCourseId],
  );
  const activeHomework = useMemo(() => {
    const picked =
      selectedHomeworkId &&
      dashboard?.homeworks?.find((h) => h.id === selectedHomeworkId);
    if (
      picked &&
      (!currentCourseId || picked.course_id === currentCourseId)
    ) {
      return picked;
    }
    return autoHomework;
  }, [selectedHomeworkId, dashboard, autoHomework, currentCourseId]);
  const homeworkDone = attempts.some(
    (a) => a.homework_id === activeHomework?.id && a.completed_homework,
  );
  const stats = useMemo(
    () => studentProfileStats(attempts, dashboard),
    [attempts, dashboard],
  );
  const allTaskList = useMemo(
    () => studentTaskList(dashboard, user),
    [dashboard, user],
  );
  const taskList = useMemo(() => {
    if (!currentCourseId) return allTaskList;
    return allTaskList.filter((t) => t.homework.course_id === currentCourseId);
  }, [allTaskList, currentCourseId]);
  const pendingCount = taskList.filter((t) => t.status !== "done").length;

  // 伴学主导航：练 / 任务 / 我（教练在练习台内召唤，不单独占底栏）
  const mobileScenes: { id: Scene; label: string; icon: React.ReactNode }[] = [
    { id: "flow", label: "练习", icon: <Layers size={16} /> },
    { id: "home", label: "今日", icon: <ListChecks size={16} /> },
    { id: "code", label: "审查", icon: <Code2 size={16} /> },
    { id: "tasks", label: "任务", icon: <GraduationCap size={16} /> },
    { id: "profile", label: "我的", icon: <UserRound size={16} /> },
  ];

  const desktopScenes: { id: Scene; label: string; icon: React.ReactNode }[] = [
    { id: "flow", label: "练习", icon: <Layers size={16} /> },
    { id: "home", label: "今日", icon: <ListChecks size={16} /> },
    { id: "code", label: "代码审查", icon: <Code2 size={16} /> },
    { id: "tasks", label: "任务", icon: <GraduationCap size={16} /> },
    { id: "profile", label: "我的", icon: <UserRound size={16} /> },
  ];

  function selectTask(homeworkId: string) {
    setSelectedHomeworkId(homeworkId);
    setScene("flow");
  }

  function enterCourse(courseId: string) {
    setCurrentCourseId(courseId);
    setSelectedHomeworkId(null);
    setScene("flow");
  }

  /** 今日页：选课只过滤范围，不强制跳进学习流 */
  function filterCourse(courseId: string | null) {
    setCurrentCourseId(courseId);
    setSelectedHomeworkId(null);
  }

  const continueTarget = useMemo(() => {
    if (activeHomework && !homeworkDone) return activeHomework;
    return taskList.find((t) => t.status !== "done")?.homework ?? null;
  }, [activeHomework, homeworkDone, taskList]);

  // 首次有数据：未关引导先停「今日」（保证高亮目标可见）；否则有任务进练习
  useEffect(() => {
    if (booted || !dashboard) return;
    setBooted(true);
    if (continueTarget) setSelectedHomeworkId(continueTarget.id);
    if (!isOnboardDismissed("student")) {
      setScene("home");
      return;
    }
    if (continueTarget) setScene("flow");
    else setScene("home");
  }, [booted, dashboard, continueTarget]);

  /** 专注答题：收起主导航，只留轻顶栏 */
  const inFocusPractice =
    scene === "flow" && Boolean(activeHomework) && !homeworkDone;

  let body: React.ReactNode;
  if (scene === "home") {
    body = (
      <HomeContinueScene
        activeHomework={activeHomework}
        homeworkDone={homeworkDone}
        taskList={taskList}
        allTaskList={allTaskList}
        currentCourseId={currentCourseId}
        trustScore={stats.score}
        understandingScore={stats.understandingScore}
        styleLabel={stats.style}
        weakness={stats.weakness}
        completedSteps={stats.completed}
        onContinue={() => {
          if (continueTarget) selectTask(continueTarget.id);
          else setScene("tasks");
        }}
        onOpenTasks={() => setScene("tasks")}
        onOpenAsk={() => setScene("ask")}
        onOpenCourses={() => setScene("courses")}
        onOpenProfile={() => setScene("profile")}
        onOpenFlow={() => setScene("flow")}
        onSelectTask={selectTask}
        onSelectCourse={filterCourse}
      />
    );
  } else if (scene === "tasks") body = <TasksScene onSelect={selectTask} />;
  else if (scene === "ask")
    body = (
      <AskScene
        companion
        onBack={() => setScene(activeHomework ? "flow" : "home")}
      />
    );
  else if (scene === "code")
    body = (
      <CodeReviewScene
        companion
        onBack={() => setScene(activeHomework ? "flow" : "home")}
      />
    );
  else if (scene === "profile") body = <ProfileScene />;
  else if (scene === "courses")
    body = (
      <CoursesScene
        currentCourseId={currentCourseId}
        onEnter={enterCourse}
        onBack={() => setScene("home")}
        onContinueHomework={(homeworkId, courseId) => {
          setCurrentCourseId(courseId);
          setSelectedHomeworkId(homeworkId);
          setScene("flow");
        }}
      />
    );
  else if (activeHomework && homeworkDone) {
    const nextHw =
      taskList.find(
        (t) =>
          t.status !== "done" && t.homework.id !== activeHomework.id,
      )?.homework ?? null;
    body = (
      <CelebrateScene
        homework={activeHomework}
        onProfile={() => setScene("profile")}
        onAsk={() => setScene("ask")}
        nextHomework={nextHw}
        onNext={
          nextHw
            ? () => selectTask(nextHw.id)
            : undefined
        }
      />
    );
  }
  else if (activeHomework)
    body = <LearningFlow homework={activeHomework} attempts={attempts} />;
  else
    body = (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Layers size={32} className="text-brand/40" />
        <strong className="text-base font-semibold text-foreground">
          还没有可练习的任务
        </strong>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          请到「任务」里选一份，或等老师发布后再来。
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setScene("tasks")}
            className="btn-brand"
          >
            去选任务
          </button>
          <button
            type="button"
            onClick={() => setScene("home")}
            className="btn-ghost"
          >
            返回今日
          </button>
        </div>
      </div>
    );

  /**
   * 固定视口壳 + 中间唯一滚动层。
   * flex 关键：父级明确 height；可滚子项用 flex:1 1 0% + height:0，
   * 避免「被子内容撑开 → 不出现 overflow → 滚轮失效」。
   */
  const shellStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    maxHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--background)",
    color: "var(--foreground)",
    zIndex: 1,
  };
  /** 练习页：一屏沉浸，主区不整页滚动；其它页正常滚动 */
  const mainStyle: CSSProperties = inFocusPractice
    ? {
        flex: "1 1 0%",
        minHeight: 0,
        height: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }
    : {
        flex: "1 1 0%",
        minHeight: 0,
        height: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        touchAction: "pan-y",
      };

  return (
    <div style={shellStyle} data-student-shell="1">
      {/* 引导始终挂载：关闭必须可靠；目标在今日主卡 + 主导航 */}
      {!demo.hideChrome && (
        <OnboardingBanner
          id="student"
          title="开始伴学"
          forceShow={forceGuide}
          onDismiss={() => setForceGuide(false)}
          onVisibilityChange={(v) => {
            if (!v) setForceGuide(false);
          }}
          steps={[
            {
              id: "home",
              target: "tour-home-card",
              label: "从这里接着练",
              hint: "点主卡片进入练习台。卡住了在答题页点「教练」，不用离开。",
              done: Boolean(continueTarget) && homeworkDone,
            },
            {
              id: "tasks",
              target: "tour-nav-tasks",
              label: "任务在清单里",
              hint: "换一份作业到「任务」；日常从「练习 / 今日」继续。",
              done: allTaskList.length > 0,
            },
            {
              id: "profile",
              target: "tour-nav-profile",
              label: "画像看成长",
              hint: "信任分与薄弱点在「我的」里，答得好提示会更开放。",
              done: stats.completed > 0,
            },
          ]}
          onStepClick={handleTourStep}
        />
      )}

      {/* 统一壳：药丸导航始终在，练习只是中间内容区换场景 */}
      <header
        style={{ flexShrink: 0 }}
        className="z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0 leading-tight">
            <strong className="block text-sm font-semibold tracking-tight">
              云雀伴学
            </strong>
            <span className="block truncate text-xs text-muted-foreground">
              {inFocusPractice
                ? activeHomework?.title ?? "练习中"
                : currentCourse?.name ?? "沉浸练习"}
              {!inFocusPractice && pendingCount > 0
                ? ` · ${pendingCount} 待办`
                : ""}
              {inFocusPractice ? ` · 信任 ${stats.score}` : ""}
            </span>
          </div>
        </div>

        <nav
          className="hidden items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm min-[721px]:flex"
          aria-label="学生主导航"
        >
          {desktopScenes.map((s) => (
            <button
              key={s.id}
              type="button"
              data-tour={
                s.id === "flow"
                  ? "tour-nav-learn"
                  : s.id === "tasks"
                    ? "tour-nav-tasks"
                    : s.id === "profile"
                      ? "tour-nav-profile"
                      : s.id === "home"
                        ? "tour-nav-home"
                        : undefined
              }
              onClick={() => setScene(s.id)}
              className={
                scene === s.id
                  ? "inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
                  : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] text-brand min-[900px]:inline-flex">
            信任 <strong className="tabular-nums">{stats.score}</strong>
          </span>
          {!demo.hideChrome && (
            <>
              <ThemeToggle size="sm" />
              <OnboardingTrigger onClick={showGuide} label="引导" />
              <button
                type="button"
                onClick={refresh}
                aria-label="刷新"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw size={15} />
              </button>
              <ProfileMenu
                align="end"
                variant="scene"
                onOpenProfile={() => setScene("profile")}
              />
            </>
          )}
          {demo.isDemo && (
            <span
              aria-label="录屏模式"
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200"
            >
              录屏
            </span>
          )}
        </div>
      </header>

      {(notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={
            error
              ? "shrink-0 bg-danger-soft px-6 py-1.5 text-center text-xs text-danger"
              : "shrink-0 bg-success-soft px-6 py-1.5 text-center text-xs text-success"
          }
        >
          {error || notice}
        </div>
      )}

      <main
        id="student-scroll-root"
        ref={scrollRef}
        style={mainStyle}
        tabIndex={0}
      >
        <div
          style={
            inFocusPractice
              ? {
                  flex: "1 1 0%",
                  minHeight: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
              : {
                  paddingBottom: 48,
                  minHeight: "100%",
                }
          }
        >
          {body}
        </div>
      </main>

      {/* 移动端底栏始终保留；练习时略压缩高度，仍保持壳层一致 */}
      <nav
        style={{ flexShrink: 0 }}
        className={
          inFocusPractice
            ? "flex border-t border-border bg-background/95 backdrop-blur min-[721px]:hidden"
            : "flex border-t border-border bg-background/95 backdrop-blur min-[721px]:hidden"
        }
        aria-label="学生主导航"
      >
        {mobileScenes.map((s) => (
          <button
            key={s.id}
            type="button"
            data-tour={
              s.id === "flow"
                ? "tour-nav-learn"
                : s.id === "tasks"
                  ? "tour-nav-tasks"
                  : s.id === "profile"
                    ? "tour-nav-profile"
                    : s.id === "home"
                      ? "tour-nav-home"
                      : undefined
            }
            onClick={() => setScene(s.id)}
            className={
              scene === s.id
                ? "flex flex-1 flex-col items-center gap-1 py-2.5 text-brand"
                : "flex flex-1 flex-col items-center gap-1 py-2.5 text-muted-foreground"
            }
          >
            {s.icon}
            <span className="text-[11px]">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
