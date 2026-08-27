"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/components/session-provider";
import { useDemoMode, isDemoRole } from "@/lib/demo-mode";
import type { Role } from "@/lib/types";

const roleLabel: Record<string, string> = {
  admin: "超级管理员",
  teacher: "教师",
  student: "学生",
};

const roleHome: Record<string, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

/**
 * Gates a portal segment by role. Replaces the old client-side `portalRoute` +
 * `PortalMismatch` logic. Redirects unauthenticated users to /login; shows a
 * mismatch screen when a logged-in user opens the wrong portal.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const demo = useDemoMode();
  // 慢网络/死锁时给用户反馈：最多等 6 秒还没拿到 user，自动跳登录
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // 演示模式：把 ?demo / ?hidechrome 一起带到登录页，否则自动登录后丢失
      const next = new URLSearchParams();
      next.set("portal", role);
      // 透传 URL 上的演示参数（手动 demo 模式、录屏模式）
      const demoParam = searchParams.get("demo");
      const hideParam = searchParams.get("hidechrome");
      if (demoParam && isDemoRole(demoParam)) {
        next.set("demo", demoParam);
      } else if (demo.demoRole) {
        next.set("demo", demo.demoRole);
      }
      if (hideParam === "1" || hideParam === "true" || demo.hideChrome) {
        next.set("hidechrome", "1");
      }
      router.replace(`/login?${next.toString()}`);
    }
  }, [loading, user, role, router, searchParams, demo.demoRole, demo.hideChrome]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <div className="flex items-center gap-2 text-sm tracking-wide">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" />
          {slow ? "网络较慢，正在尝试恢复…" : "加载中…"}
        </div>
        {slow && (
          <button
            type="button"
            onClick={() => router.replace(demo.withDemo(`/login?portal=${role}`))}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            跳到登录
          </button>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <span className="text-sm tracking-wide">正在跳转到登录…</span>
      </div>
    );
  }

  if (user.role !== role) {
    return <PortalMismatch userRole={user.role} requested={role} />;
  }

  return <>{children}</>;
}

function PortalMismatch({
  userRole,
  requested,
}: {
  userRole: string;
  requested: string;
}) {
  const { logout } = useSession();
  const router = useRouter();
  const demo = useDemoMode();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          当前账号属于{roleLabel[userRole] ?? userRole}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          你打开的是{roleLabel[requested] ?? requested}
          入口。请进入当前账号对应端，或退出后切换账号。
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => router.push(demo.withDemo(roleHome[userRole] ?? "/"))}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            进入{roleLabel[userRole] ?? userRole}端
          </button>
          <button
            onClick={() => {
              logout();
              router.push(demo.withDemo("/login"));
            }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
