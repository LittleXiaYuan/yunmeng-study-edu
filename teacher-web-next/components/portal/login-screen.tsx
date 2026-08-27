"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogIn, Sparkles, Video } from "lucide-react";
import dynamic from "next/dynamic";
import { useSession } from "@/components/session-provider";
import { useDemoMode, isDemoRole } from "@/lib/demo-mode";
import type { Role } from "@/lib/types";

// React Bits WebGL 组件：懒加载 + 关闭 SSR（skill 最佳实践）
const SilkWaves = dynamic(() => import("@/components/silk-waves"), {
  ssr: false,
});

// 教学系统深蓝专业配色
const SILK_COLORS = [
  "#02030a",
  "#0a1330",
  "#122152",
  "#1a3072",
  "#2242a0",
  "#2e5ac0",
  "#3f78e0",
  "#5b93f2",
];

const presets: Record<Role, { username: string; password: string }> = {
  admin: { username: "admin", password: "admin123456" },
  teacher: { username: "teacher", password: "teacher123456" },
  student: { username: "student001", password: "student123456" },
};

const portalLabels: { key: Role; label: string }[] = [
  { key: "admin", label: "超管端" },
  { key: "teacher", label: "教师端" },
  { key: "student", label: "学生端" },
];

const roleHome: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

export function LoginScreen(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, logout, busy, error } = useSession();
  const demo = useDemoMode();

  const initialPortal = (() => {
    const fromDemo = demo.demoRole;
    if (fromDemo) return fromDemo;
    const fromPortal = searchParams.get("portal") as Role | null;
    if (fromPortal && isDemoRole(fromPortal)) return fromPortal;
    return "admin" as Role;
  })();
  const [portal, setPortal] = useState<Role>(initialPortal);
  const [form, setForm] = useState(presets[initialPortal]);
  const autoSubmitted = useRef(false);

  // 演示模式：自动选 portal + 自动提交（每个 portal 一次）
  // 注意：故意不返回 cleanup 清掉 setTimeout，否则 useEffect 在 user 变化时会取消定时器
  // 而定时器触发后即使 LoginScreen 已被替换也不会出问题（router.replace 是幂等的）
  useEffect(() => {
    if (!demo.demoRole || autoSubmitted.current) return;
    // 已登录但角色不匹配：先清掉旧 token，再自动登新角色
    if (user && user.role !== demo.demoRole) {
      logout();
      autoSubmitted.current = true;
      setTimeout(() => {
        void handleLoginWith(presets[demo.demoRole!]);
      }, 120);
      return;
    }
    if (user) return; // 已登录且角色一致，交给「已登录则跳走」逻辑
    autoSubmitted.current = true;
    setPortal(demo.demoRole);
    setForm(presets[demo.demoRole]);
    setTimeout(() => {
      void handleLoginWith(presets[demo.demoRole!]);
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.demoRole, user]);

  // If already logged in (且与演示目标一致)，bounce 到对应 portal。
  // 演示模式下：当前角色 != 目标角色时不走这里，让 auto-login 流程处理。
  useEffect(() => {
    if (!user || !user.role) return;
    if (demo.demoRole && demo.demoRole !== user.role) return;
    router.replace(demo.withDemo(roleHome[user.role as Role] ?? "/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, demo.demoRole]);

  function choosePortal(next: Role) {
    setPortal(next);
    setForm(presets[next]);
  }

  async function handleLoginWith(creds: { username: string; password: string }) {
    const u = await login(creds.username, creds.password);
    if (u && u.role) {
      router.replace(demo.withDemo(roleHome[u.role as Role] ?? "/"));
    }
  }

  async function handleLogin() {
    await handleLoginWith(form);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#02030a] px-6 py-16">
      <div aria-hidden="true" className="absolute inset-0 h-full w-full">
        <SilkWaves
          className="absolute inset-0"
          colors={SILK_COLORS}
          speed={1.2}
          scale={2}
          opacity={0.95}
        />
      </div>

      {demo.isDemo && (
        <div
          aria-label="录屏模式"
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100 backdrop-blur"
        >
          <Video size={12} />
          录屏模式{demo.demoRole ? ` · ${demo.demoRole}` : ""}
        </div>
      )}

      <section className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#3b5bdb]/85 text-white shadow-lg shadow-[#3b5bdb]/30">
          <Sparkles size={22} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
          云雀教学
        </span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {demo.demoRole ? `自动登录 ${demo.demoRole} 端…` : "进入教学服务平台"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          超管看总览，教师管课程任务，学生专注分步练习。
        </p>

        <div className="mt-6 grid grid-cols-3 gap-1.5 rounded-xl border border-white/15 bg-white/5 p-1">
          {portalLabels.map((p) => (
            <button
              key={p.key}
              onClick={() => choosePortal(p.key)}
              className={
                portal === p.key
                  ? "rounded-lg bg-[#3b5bdb] px-3 py-2 text-xs font-semibold text-white shadow-sm"
                  : "rounded-lg px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-100"
          >
            {error}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">
              账号
            </span>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">
              密码
            </span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/40"
            />
          </label>
        </div>

        <button
          onClick={handleLogin}
          disabled={busy === "login"}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <LogIn size={17} />
          {busy === "login" ? "登录中…" : "登录"}
        </button>

        <div className="mt-4 flex items-center gap-2">
          {portalLabels.map((p) => (
            <button
              key={p.key}
              onClick={() => choosePortal(p.key)}
              className="flex-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
            >
              {p.label}预设
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
