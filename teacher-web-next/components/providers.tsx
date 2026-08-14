"use client";

import { ShaderVariantProvider } from "@/components/shader-variant-context";
import { SessionProvider } from "@/components/session-provider";
import { ReducedMotionProvider } from "@/lib/motion";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 门户页不再挂 Lenis / SmoothScroll，避免滚轮被劫持。
 * 主题切换、配色切换在门户里隐藏，减少 fixed 浮层干扰。
 */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname() || "/";
  const isPortal =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname === "/login";

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReducedMotionProvider>
        <MotionConfig reducedMotion="user">
          <ShaderVariantProvider>
            <SessionProvider>
              {children}
              {/* 门户页不渲染首页用的 fixed 控件 */}
              {!isPortal && null}
            </SessionProvider>
          </ShaderVariantProvider>
        </MotionConfig>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
