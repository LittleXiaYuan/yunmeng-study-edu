"use client";

import { ShaderVariantToggle } from "@/components/shader-variant-toggle";
import { ThemeSwitch } from "@/components/theme-switch";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** 仅营销首页显示主题/配色浮钮；门户页隐藏，避免挡操作。 */
export function PortalChrome(): ReactNode {
  const pathname = usePathname() || "/";
  const isPortal =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname === "/login";

  if (isPortal) return null;

  return (
    <>
      <ShaderVariantToggle />
      <ThemeSwitch />
    </>
  );
}
