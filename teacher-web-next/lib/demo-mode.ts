"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Role } from "@/lib/types";

/**
 * 演示模式开关（URL 参数驱动）：
 *
 * - `?demo=admin|teacher|student`  登录页自动填入对应预设账号 + 自动登录
 * - `?hidechrome=1`                录屏时隐藏浮窗 / 引导 / 退出按钮，纯净展示
 *
 * 全部状态都从 URL 实时读取，刷新 / 分享链接 / 录屏后观众点开都是同一份表现。
 */
export interface DemoModeState {
  /** 当前命中 ?demo= 的角色；若未指定则为 null */
  demoRole: Role | null;
  /** 当前是否要隐藏演示无关 UI（浮窗 / 引导 / 退出按钮） */
  hideChrome: boolean;
  /** 当前是否在任意一种演示模式 */
  isDemo: boolean;
  /** 构造一个带演示参数的 URL（用于把 demo 状态往下个页面带） */
  withDemo: (path: string) => string;
  /** 仅在 demo 模式下让 link 保留 hidechrome 等参数；普通链接直通 */
  demoHref: (path: string) => string;
}

const DEMO_ROLES: Role[] = ["admin", "teacher", "student"];

export function isDemoRole(v: string | null): v is Role {
  return v !== null && (DEMO_ROLES as string[]).includes(v);
}

export function useDemoMode(): DemoModeState {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const demoParam = params.get("demo");
  const hideParam = params.get("hidechrome");
  const demoRole: Role | null = isDemoRole(demoParam) ? demoParam : null;
  const hideChrome = hideParam === "1" || hideParam === "true";
  const isDemo = demoRole !== null || hideChrome;

  const buildQuery = useCallback(
    (extra?: Record<string, string>) => {
      const next = new URLSearchParams();
      if (demoRole) next.set("demo", demoRole);
      if (hideChrome) next.set("hidechrome", "1");
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          if (v) next.set(k, v);
        }
      }
      const qs = next.toString();
      return qs ? `?${qs}` : "";
    },
    [demoRole, hideChrome],
  );

  const withDemo = useCallback(
    (path: string) => `${path}${buildQuery()}`,
    [buildQuery],
  );

  const demoHref = useCallback(
    (path: string) => (isDemo ? `${path}${buildQuery()}` : path),
    [isDemo, buildQuery],
  );

  // 防止 useMemo 报错：保留 router / pathname 引用，便于后续扩展（例如 demo 模式路由守卫）
  void router;
  void pathname;

  return useMemo(
    () => ({ demoRole, hideChrome, isDemo, withDemo, demoHref }),
    [demoRole, hideChrome, isDemo, withDemo, demoHref],
  );
}
