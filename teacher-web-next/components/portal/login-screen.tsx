"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogIn, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useSession } from "@/components/session-provider";
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
  const { user, login, busy, error } = useSession();

  const initialPortal = (searchParams.get("portal") as Role) || "admin";
  const [portal, setPortal] = useState<Role>(
    ["admin", "teacher", "student"].includes(initialPortal)
      ? initialPortal
      : "admin",
  );
  const [form, setForm] = useState(presets[portal]);

  // If already logged in, bounce to the right portal.
  useEffect(() => {
    if (user && user.role) {
      router.replace(roleHome[user.role as Role] ?? "/");
    }
  }, [user, router]);

  function choosePortal(next: Role) {
    setPortal(next);
    setForm(presets[next]);
  }

  async function handleLogin() {
    const u = await login(form.username, form.password);
    if (u && u.role) {
      router.replace(roleHome[u.role as Role] ?? "/");
    }
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

      <section className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#3b5bdb]/85 text-white shadow-lg shadow-[#3b5bdb]/30">
          <Sparkles size={22} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
          云雀教学
        </span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          进入教学服务平台
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
