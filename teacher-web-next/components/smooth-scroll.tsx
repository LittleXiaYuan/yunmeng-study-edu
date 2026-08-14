"use client";

import { features } from "@/lib/config";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const LENIS_OPTIONS = {
  duration: 1.6,
  easing: (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical" as const,
  gestureOrientation: "vertical" as const,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 2,
};

const ANCHOR_OFFSET = -100;

/**
 * Lenis 仅在营销首页 `/` 启用。
 * 其它路径（尤其 /student 画像）一律原生滚动，避免 wheel 被劫持。
 */
function shouldEnableLenis(pathname: string): boolean {
  return pathname === "/";
}

export function SmoothScroll({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (!features.smoothScroll) return;
    if (!shouldEnableLenis(pathname)) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis(LENIS_OPTIONS);

    gsap.registerPlugin(ScrollTrigger);
    lenis.on("scroll", ScrollTrigger.update);
    const tickerFn = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    function handleAnchorClick(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const element = document.querySelector(href);
      if (!element || !(element instanceof HTMLElement)) return;
      event.preventDefault();
      lenis.scrollTo(element, { offset: ANCHOR_OFFSET });
    }

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
      gsap.ticker.remove(tickerFn);
      lenis.destroy();
    };
  }, [pathname]);

  return <>{children}</>;
}
