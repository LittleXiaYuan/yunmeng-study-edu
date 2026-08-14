"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** 紧凑主题切换：适合门户顶栏（日 / 夜 / 跟随系统） */
export function ThemeToggle({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}): ReactNode {
  const mounted = useIsMounted();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const box =
    size === "sm"
      ? "h-8 w-8 rounded-lg"
      : "h-9 w-9 rounded-xl";
  const icon = size === "sm" ? 15 : 16;

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="切换主题"
        className={`inline-flex ${box} items-center justify-center text-muted-foreground opacity-40 ${className}`}
      >
        <Sun size={icon} />
      </button>
    );
  }

  // 点击循环：light → dark → system → light
  function cycle() {
    const order = ["light", "dark", "system"] as const;
    const cur = (theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system") as (typeof order)[number];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setTheme(next);
  }

  const isDark = resolvedTheme === "dark";
  const label =
    theme === "system"
      ? "主题：跟随系统（点击切换）"
      : isDark
        ? "主题：夜间（点击切换）"
        : "主题：日间（点击切换）";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={`inline-flex ${box} items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      {theme === "system" ? (
        <Monitor size={icon} aria-hidden />
      ) : isDark ? (
        <Moon size={icon} aria-hidden />
      ) : (
        <Sun size={icon} aria-hidden />
      )}
    </button>
  );
}
