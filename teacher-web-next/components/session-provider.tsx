"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "@/lib/api";
import { UnauthorizedError } from "@/lib/api";
import type {
  ChatMessage,
  ClassDraft,
  CourseDraft,
  Dashboard,
  HomeworkDraft,
  HomeworkTask,
  LessonUploadResponse,
  LLMConfig,
  PageContext,
  StudentDraft,
  User,
} from "@/lib/types";

interface SessionContextValue {
  user: User | null;
  dashboard: Dashboard | null;
  llmConfig: LLMConfig;
  loading: boolean;
  busy: string;
  notice: string;
  error: string;
  setError: (v: string) => void;
  dismissStatus: () => void;
  // auth
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
  refresh: () => Promise<void>;
  // drafts
  lessonText: string;
  setLessonText: (v: string) => void;
  selectedFiles: File[];
  setSelectedFiles: (v: File[]) => void;
  /** 最近一次智能导入报告（供上传面板展示） */
  lastUploadReport: LessonUploadResponse | null;
  clearUploadReport: () => void;
  uploadMaterials: (
    onSuccess?: () => void,
    opts?: { courseId?: string; title?: string },
  ) => Promise<void>;
  classDraft: ClassDraft;
  setClassDraft: (v: ClassDraft) => void;
  createClass: () => Promise<void>;
  courseDraft: CourseDraft;
  setCourseDraft: (v: CourseDraft) => void;
  createCourse: () => Promise<void>;
  studentDraft: StudentDraft;
  setStudentDraft: (v: StudentDraft) => void;
  createStudent: () => Promise<void>;
  // images
  uploadAvatar: (file: File) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  // homework draft
  homeworkDraft: HomeworkDraft;
  setHomeworkDraft: (v: HomeworkDraft) => void;
  createHomeworkTask: (onSuccess?: () => void) => Promise<void>;
  // agent chat
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  /** 当前屏幕上下文（作业台注入后，教练可“看见”题干与草稿） */
  pageContext: PageContext | null;
  setPageContext: (v: PageContext | null) => void;
  sendAgentMessage: (overridePageContext?: PageContext | null) => Promise<void>;
  // homework
  studentAnswer: string;
  setStudentAnswer: (v: string) => void;
  submitStudentHomework: (hw: HomeworkTask) => Promise<void>;
  // llm config
  setLLMConfig: (v: LLMConfig) => void;
  saveLLMConfig: () => Promise<void>;
}

const emptyLLMConfig: LLMConfig = {
  base_url: "",
  api_key: "",
  model: "",
  enabled: false,
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(emptyLLMConfig);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [lessonText, setLessonText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lastUploadReport, setLastUploadReport] =
    useState<LessonUploadResponse | null>(null);
  const clearUploadReport = useCallback(() => setLastUploadReport(null), []);
  const [classDraft, setClassDraft] = useState<ClassDraft>({
    name: "",
    grade: "",
    teacher_id: "",
  });
  const [courseDraft, setCourseDraft] = useState<CourseDraft>({
    name: "",
    class_id: "",
  });
  const [studentDraft, setStudentDraft] = useState<StudentDraft>({
    name: "",
    class_id: "",
    username: "",
    password: "",
    create_user: false,
  });
  const [homeworkDraft, setHomeworkDraft] = useState<HomeworkDraft>({
    title: "",
    prompt: "",
    class_id: "",
    course_id: "",
    lesson_id: "",
    steps: [],
    published: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissStatus = useCallback(() => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNotice("");
    setError("");
  }, []);

  const flashNotice = useCallback((msg: string) => {
    setError("");
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice("");
      noticeTimer.current = null;
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const handleUnauthorized = useCallback((e: unknown) => {
    if (e instanceof UnauthorizedError) {
      api.clearToken();
      setUser(null);
      setDashboard(null);
      return true;
    }
    return false;
  }, []);

  const loadDashboardAndConfig = useCallback(async (role: string) => {
    const dash = await api.fetchDashboard();
    setDashboard(dash);
    if (role === "admin" || role === "teacher") {
      const config = await api.getLLMConfig();
      if (config) setLLMConfig(config);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.fetchMe();
      if (me && me.role) {
        setUser(me);
        await loadDashboardAndConfig(me.role);
      }
    } catch (e) {
      handleUnauthorized(e);
    }
  }, [loadDashboardAndConfig, handleUnauthorized]);

  // Session restore on mount
  useEffect(() => {
    (async () => {
      // ?logout=1 / ?demo=role：一进页面就清旧 token，让 RoleGuard 跳 login
      // （RoleGuard 看到 user=null 时会自动跳 /login?demo=...&portal=...）
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        if (sp.has("logout") || sp.has("demo")) {
          api.clearToken();
        }
      }
      try {
        if (api.getToken()) await refresh();
      } catch {
        // refresh 失败（超时/网络/5xx）：清掉过期 token，让 RoleGuard 跳登录
        api.clearToken();
        setUser(null);
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<User | null> => {
      setBusy("login");
      setError("");
      try {
        const { token, user: u } = await api.login(username, password);
        if (token) api.setToken(token);
        setUser(u);
        await loadDashboardAndConfig(u.role);
        return u;
      } catch (e) {
        setError(e instanceof Error ? e.message : "登录失败");
        return null;
      } finally {
        setBusy("");
      }
    },
    [loadDashboardAndConfig],
  );

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    setDashboard(null);
    setMessages([]);
    setInput("");
    setStudentAnswer("");
    setError("");
    setNotice("");
    setBusy("");
  }, []);

  const runMutation = useCallback(
    async (token: string, fn: () => Promise<void>, done?: () => void) => {
      setBusy(token);
      setError("");
      try {
        await fn();
        if (user) await loadDashboardAndConfig(user.role);
        done?.();
      } catch (e) {
        if (!handleUnauthorized(e)) {
          setError(e instanceof Error ? e.message : "操作失败");
        }
      } finally {
        setBusy("");
      }
    },
    [user, loadDashboardAndConfig, handleUnauthorized],
  );

  const uploadMaterials = useCallback(
    (onSuccess?: () => void, opts?: { courseId?: string; title?: string }) =>
      runMutation(
        "upload",
        async () => {
          const report = await api.uploadMaterials(
            selectedFiles,
            lessonText,
            opts,
          );
          setLastUploadReport(report);
          const accepted = report.stats?.accepted ?? report.total ?? 0;
          const skipped = report.stats?.skipped ?? report.skipped?.length ?? 0;
          const intent = report.intent?.label;
          flashNotice(
            intent
              ? `${intent}：入库 ${accepted} · 跳过 ${skipped}`
              : report.message ||
                  `导入完成：入库 ${accepted}，跳过 ${skipped}`,
          );
        },
        () => {
          setSelectedFiles([]);
          setLessonText("");
          // 成功后不立刻关抽屉：让用户先看导入报告；由面板自行 onDone
          onSuccess?.();
        },
      ),
    [runMutation, selectedFiles, lessonText, flashNotice],
  );

  const createClass = useCallback(
    () =>
      runMutation(
        "class",
        () => api.createClass(classDraft),
        () => setClassDraft({ name: "", grade: "", teacher_id: "" }),
      ),
    [runMutation, classDraft],
  );

  const createCourse = useCallback(
    () =>
      runMutation(
        "course",
        () => api.createCourse(courseDraft),
        () => setCourseDraft({ name: "", class_id: "" }),
      ),
    [runMutation, courseDraft],
  );

  const createStudent = useCallback(
    () =>
      runMutation(
        "student",
        () => api.createStudent(studentDraft),
        () =>
          setStudentDraft({
            name: "",
            class_id: "",
            username: "",
            password: "",
            create_user: false,
          }),
      ),
    [runMutation, studentDraft],
  );

  const uploadImage = useCallback(
    async (kind: "avatar" | "background", file: File) => {
      if (!user) return;
      setBusy(kind);
      setError("");
      try {
        const updated = await api.uploadUserImage(user.id, kind, file);
        setUser(updated);
        flashNotice(kind === "avatar" ? "头像已更新" : "背景图已更新");
      } catch (e) {
        if (!handleUnauthorized(e)) {
          setError(e instanceof Error ? e.message : "上传失败");
        }
      } finally {
        setBusy("");
      }
    },
    [user, handleUnauthorized, flashNotice],
  );

  const uploadAvatar = useCallback(
    (file: File) => uploadImage("avatar", file),
    [uploadImage],
  );

  const uploadBackground = useCallback(
    (file: File) => uploadImage("background", file),
    [uploadImage],
  );

  const createHomeworkTask = useCallback(
    (onSuccess?: () => void) =>
      runMutation(
        "homework-create",
        async () => {
          await api.createHomework(homeworkDraft);
          flashNotice(
            homeworkDraft.published ? "任务已发布" : "草稿已保存",
          );
        },
        () => {
          setHomeworkDraft({
            title: "",
            prompt: "",
            class_id: "",
            course_id: "",
            lesson_id: "",
            steps: [],
            published: true,
          });
          onSuccess?.();
        },
      ),
    [runMutation, homeworkDraft, flashNotice],
  );

  const sendAgentMessage = useCallback(
    async (overridePageContext?: PageContext | null) => {
      if (!input.trim()) return;
      const msg = input;
      setInput("");
      const history = messages;
      const ctx =
        overridePageContext === undefined
          ? pageContext
          : overridePageContext;
      const userMsgId = Date.now().toString();
      const assistantMsgId = `${userMsgId}-a`;
      // 先插入流式占位气泡：收到首个增量前显示打字点，之后逐字追加
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: msg },
        { id: assistantMsgId, role: "assistant", content: "", streaming: true },
      ]);
      const patchAssistant = (
        patch:
          | Partial<ChatMessage>
          | ((m: ChatMessage) => Partial<ChatMessage>),
      ) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) }
              : m,
          ),
        );
      setBusy("chat");
      try {
        // 学生端优先用 student_id；兼容 user.id 回退
        const studentId = user?.student_id || user?.id || "";
        const activeCourse =
          dashboard?.courses?.find((c) => !c.archived) ??
          dashboard?.courses?.[0];
        const params = {
          studentId,
          courseId: activeCourse?.id ?? "",
          question: msg,
          history,
          pageContext: ctx,
        };
        let streamed = false;
        let res: { message?: string; rag?: import("@/lib/types").RAGContext };
        try {
          res = await api.sendChatStream(params, (delta) => {
            streamed = true;
            patchAssistant((m) => ({ content: m.content + delta }));
          });
        } catch (e) {
          // 已经吐过增量或鉴权失败就不再重试；否则回退旧的整段接口
          if (streamed || e instanceof UnauthorizedError) throw e;
          res = await api.sendChat(params);
        }
        let content = res.message || "Agent 已回复";
        // 若有知识库命中，在回复下附一行「看见的依据」（Gemini 感）
        const hits = res.rag?.hits?.slice(0, 2) ?? [];
        if (hits.length > 0) {
          const cites = hits
            .map((h) => `《${h.title}》`)
            .filter(Boolean)
            .join("、");
          if (cites) {
            content = `${content}\n\n📎 结合了你当前页面与资料：${cites}`;
          }
        } else if (ctx?.step_title || ctx?.instruction) {
          content = `${content}\n\n👁 已参考你屏幕上的「${ctx.step_title || ctx.title || "当前步骤"}」`;
        }
        patchAssistant({ content, streaming: false, variant: "welcome" });
        if (user) await loadDashboardAndConfig(user.role);
      } catch (e) {
        // 失败时移除还空着的占位气泡（有部分内容则保留已收到的文字）
        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === assistantMsgId ? { ...m, streaming: false } : m,
            )
            .filter((m) => !(m.id === assistantMsgId && !m.content)),
        );
        if (!handleUnauthorized(e)) {
          setError(e instanceof Error ? e.message : "对话失败");
        }
      } finally {
        setBusy("");
      }
    },
    [
      input,
      messages,
      pageContext,
      dashboard,
      user,
      loadDashboardAndConfig,
      handleUnauthorized,
    ],
  );

  const submitStudentHomework = useCallback(
    (hw: HomeworkTask) =>
      runMutation(
        "student-submit",
        async () => {
          const passedSteps =
            dashboard?.homework_attempts?.filter(
              (a) => a.homework_id === hw.id && a.completed_step,
            ).length || 0;
          await api.submitHomework({
            homeworkId: hw.id,
            studentId: user?.id ?? "",
            stepIndex: passedSteps,
            answer: studentAnswer,
          });
        },
        () => setStudentAnswer(""),
      ),
    [runMutation, dashboard, user, studentAnswer],
  );

  const saveLLMConfig = useCallback(
    () =>
      runMutation(
        "llm-save",
        async () => {
          await api.saveLLMConfig(llmConfig);
          flashNotice(
            llmConfig.enabled
              ? "连接测试通过，模型配置已保存并生效"
              : "LLM 已关闭，配置已保存",
          );
        },
      ),
    [runMutation, llmConfig, flashNotice],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      dashboard,
      llmConfig,
      loading,
      busy,
      notice,
      error,
      setError,
      dismissStatus,
      login,
      logout,
      refresh,
      lessonText,
      setLessonText,
      selectedFiles,
      setSelectedFiles,
      lastUploadReport,
      clearUploadReport,
      uploadMaterials,
      classDraft,
      setClassDraft,
      createClass,
      courseDraft,
      setCourseDraft,
      createCourse,
      studentDraft,
      setStudentDraft,
      createStudent,
      uploadAvatar,
      uploadBackground,
      homeworkDraft,
      setHomeworkDraft,
      createHomeworkTask,
      messages,
      input,
      setInput,
      pageContext,
      setPageContext,
      sendAgentMessage,
      studentAnswer,
      setStudentAnswer,
      submitStudentHomework,
      setLLMConfig,
      saveLLMConfig,
    }),
    [
      user,
      dashboard,
      llmConfig,
      loading,
      busy,
      notice,
      error,
      dismissStatus,
      login,
      logout,
      refresh,
      lessonText,
      selectedFiles,
      lastUploadReport,
      clearUploadReport,
      uploadMaterials,
      classDraft,
      createClass,
      courseDraft,
      createCourse,
      studentDraft,
      createStudent,
      uploadAvatar,
      uploadBackground,
      homeworkDraft,
      createHomeworkTask,
      messages,
      input,
      pageContext,
      sendAgentMessage,
      studentAnswer,
      submitStudentHomework,
      saveLLMConfig,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
