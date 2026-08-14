"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/components/session-provider";
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

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?portal=${role}`);
    }
  }, [loading, user, role, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <span className="text-sm tracking-wide">加载中…</span>
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
            onClick={() => router.push(roleHome[userRole] ?? "/")}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            进入{roleLabel[userRole] ?? userRole}端
          </button>
          <button
            onClick={() => {
              logout();
              router.push("/login");
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
