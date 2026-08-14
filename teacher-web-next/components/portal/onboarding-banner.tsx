"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HelpCircle, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface OnboardingStep {
  id: string;
  label: string;
  done?: boolean;
  hint?: string;
  /** 对应页面上 data-tour="{id}" 的元素，用于高亮 */
  target?: string;
}

const PREFIX = "study-onboard:";

const LEGACY_KEYS: Record<string, string[]> = {
  admin: ["onboard-admin-v1", "study-onboard:admin"],
  teacher: ["onboard-teacher-v1", "study-onboard:teacher"],
  student: ["onboard-student-v1", "study-onboard:student"],
};

export function onboardStorageKey(id: string): string {
  return `${PREFIX}${id}`;
}

export function isOnboardDismissed(id: string): boolean {
  try {
    const legacy = LEGACY_KEYS[id] ?? [];
    for (const k of legacy) {
      if (k !== onboardStorageKey(id) && window.localStorage.getItem(k)) {
        window.localStorage.removeItem(k);
      }
    }
    return window.localStorage.getItem(onboardStorageKey(id)) === "1";
  } catch {
    return false;
  }
}

export function setOnboardDismissed(id: string, dismissed: boolean): void {
  try {
    const key = onboardStorageKey(id);
    if (dismissed) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
      for (const k of LEGACY_KEYS[id] ?? []) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

type Hole = { top: number; left: number; width: number; height: number };

function clearTourActive() {
  document
    .querySelectorAll('[data-tour-active="true"]')
    .forEach((n) => n.removeAttribute("data-tour-active"));
}

/**
 * 底部教练式引导：
 * - 四片遮罩挖洞（无全屏 blur，避免整页糊住）
 * - 关闭必须可靠（含 forceShow / Esc / 遮罩点击）
 */
export function OnboardingBanner({
  id,
  title,
  subtitle,
  steps,
  onStepClick,
  forceShow,
  onVisibilityChange,
  onDismiss,
}: {
  id: string;
  title: string;
  subtitle?: string;
  steps: OnboardingStep[];
  onStepClick?: (stepId: string) => void;
  forceShow?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  /** 关闭时额外回调（父级清 forceGuide） */
  onDismiss?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(true);
  const [forced, setForced] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const prevForce = useRef(false);
  const lastEntered = useRef<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const d = isOnboardDismissed(id);
    setDismissed(d);
    dismissedRef.current = d;
    setHydrated(true);
    setForced(false);
    lastEntered.current = null;
  }, [id]);

  // 仅 forceShow 上升沿重新打开
  useEffect(() => {
    if (forceShow && !prevForce.current) {
      dismissedRef.current = false;
      setForced(true);
      setDismissed(false);
      setStepIndex(0);
      lastEntered.current = null;
    }
    if (!forceShow) {
      setForced(false);
    }
    prevForce.current = Boolean(forceShow);
  }, [forceShow]);

  const reallyVisible = hydrated && (forced || !dismissed);
  const total = steps.length;
  const safeIndex = Math.min(stepIndex, Math.max(total - 1, 0));
  const step = steps[safeIndex];
  const isLast = safeIndex >= total - 1;
  const targetKey = step?.target ?? undefined;

  useEffect(() => {
    onVisibilityChange?.(reallyVisible);
  }, [reallyVisible, onVisibilityChange]);

  useEffect(() => {
    if (!reallyVisible || !step) return;
    const key = `${safeIndex}:${step.id}`;
    if (lastEntered.current === key) return;
    lastEntered.current = key;
    // 延后一帧，让父级先切场景
    const t = window.setTimeout(() => onStepClick?.(step.id), 0);
    return () => window.clearTimeout(t);
  }, [reallyVisible, safeIndex, step, onStepClick]);

  const measure = useCallback(() => {
    if (!reallyVisible || !targetKey) {
      setHole(null);
      clearTourActive();
      return;
    }
    const nodes = Array.from(
      document.querySelectorAll(`[data-tour="${CSS.escape(targetKey)}"]`),
    ) as HTMLElement[];
    const el =
      nodes.find((n) => {
        const s = window.getComputedStyle(n);
        if (
          s.display === "none" ||
          s.visibility === "hidden" ||
          s.opacity === "0"
        ) {
          return false;
        }
        const r = n.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      }) ?? null;

    if (!el) {
      setHole(null);
      clearTourActive();
      return;
    }

    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    const pad = 12;
    setHole({
      top: Math.max(4, r.top - pad),
      left: Math.max(4, r.left - pad),
      width: Math.min(window.innerWidth - 8, r.width + pad * 2),
      height: Math.min(window.innerHeight - 8, r.height + pad * 2),
    });
    clearTourActive();
    el.setAttribute("data-tour-active", "true");
  }, [reallyVisible, targetKey]);

  useLayoutEffect(() => {
    if (!reallyVisible) return;
    measure();
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 280);
    const t3 = window.setTimeout(measure, 560);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [measure, reallyVisible, safeIndex]);

  useEffect(() => {
    if (reallyVisible) return;
    clearTourActive();
    setHole(null);
  }, [reallyVisible]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setOnboardDismissed(id, true);
    setDismissed(true);
    setForced(false);
    clearTourActive();
    setHole(null);
    onDismiss?.();
    onVisibilityChange?.(false);
  }, [id, onDismiss, onVisibilityChange]);

  // Esc 关闭
  useEffect(() => {
    if (!reallyVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reallyVisible, dismiss]);

  function goNext() {
    if (!step) return;
    if (isLast) {
      dismiss();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  }

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!reallyVisible || !step || total === 0) return null;

  // 四片遮罩：中间完全透明清晰，四周半透明（无 blur）
  const dim = "rgba(8, 10, 16, 0.58)";

  return (
    <AnimatePresence>
      {reallyVisible && (
        <div
          key="coach-root"
          className="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-title"
        >
          {hole ? (
            <>
              {/* 上 */}
              <button
                type="button"
                aria-label="关闭引导"
                className="absolute inset-x-0 top-0 border-0 p-0"
                style={{ height: hole.top, background: dim }}
                onClick={dismiss}
              />
              {/* 下 */}
              <button
                type="button"
                aria-label="关闭引导"
                className="absolute inset-x-0 bottom-0 border-0 p-0"
                style={{
                  top: hole.top + hole.height,
                  background: dim,
                }}
                onClick={dismiss}
              />
              {/* 左 */}
              <button
                type="button"
                aria-label="关闭引导"
                className="absolute border-0 p-0"
                style={{
                  top: hole.top,
                  left: 0,
                  width: hole.left,
                  height: hole.height,
                  background: dim,
                }}
                onClick={dismiss}
              />
              {/* 右 */}
              <button
                type="button"
                aria-label="关闭引导"
                className="absolute border-0 p-0"
                style={{
                  top: hole.top,
                  left: hole.left + hole.width,
                  right: 0,
                  height: hole.height,
                  background: dim,
                }}
                onClick={dismiss}
              />
              {/* 高亮框（洞内不铺色，界面保持清晰） */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute z-[91] rounded-2xl"
                initial={false}
                animate={{
                  top: hole.top,
                  left: hole.left,
                  width: hole.width,
                  height: hole.height,
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 360, damping: 32 }
                }
                style={{
                  boxShadow:
                    "0 0 0 3px var(--brand), 0 0 0 6px color-mix(in srgb, var(--brand) 35%, transparent), 0 0 24px var(--brand-glow)",
                }}
              >
                {!reduceMotion && (
                  <span className="tour-pulse-ring absolute inset-0 rounded-2xl" />
                )}
              </motion.div>
            </>
          ) : (
            /* 无目标：轻遮罩，绝不 blur */
            <button
              type="button"
              aria-label="关闭引导"
              className="absolute inset-0 cursor-default border-0 bg-black/50"
              onClick={dismiss}
            />
          )}

          {!hole && targetKey && (
            <div className="pointer-events-none absolute inset-x-0 top-[28%] z-[91] flex justify-center px-4">
              <p className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground shadow-md">
                正在定位界面元素…
              </p>
            </div>
          )}

          {/* 底部气泡 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[92] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <motion.div
              key={step.id}
              initial={
                reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? undefined
                  : { opacity: 0, y: 10, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto relative w-full max-w-sm rounded-[1.35rem] border border-border bg-card px-5 pb-4 pt-4 shadow-[var(--shadow-float)]"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                aria-hidden
                className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card"
              />

              <div className="relative mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-brand">
                    {title}
                    <span className="mx-1.5 font-normal text-muted-foreground">
                      {safeIndex + 1} / {total}
                    </span>
                    {subtitle ? (
                      <span className="font-normal text-muted-foreground">
                        · {subtitle}
                      </span>
                    ) : null}
                  </p>
                  <h3
                    id="coach-title"
                    className="mt-1.5 text-lg font-semibold tracking-tight text-foreground"
                  >
                    {step.label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  aria-label="关闭引导"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              {step.hint && (
                <p className="relative mb-4 text-sm leading-relaxed text-muted-foreground">
                  {step.hint}
                </p>
              )}

              <div className="relative mb-3.5 flex items-center justify-center gap-1.5">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`第 ${i + 1} 步`}
                    onClick={() => setStepIndex(i)}
                    className={
                      i === safeIndex
                        ? "h-2 w-6 rounded-full bg-brand"
                        : s.done
                          ? "h-2 w-2 rounded-full bg-success"
                          : "h-2 w-2 rounded-full bg-border"
                    }
                  />
                ))}
              </div>

              <div className="relative flex items-center gap-2">
                {safeIndex > 0 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="btn-ghost flex-1 py-2.5 text-sm"
                  >
                    上一步
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="btn-brand flex-[1.5] py-2.5 text-sm"
                >
                  {isLast ? "我知道了" : "下一步"}
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="relative mt-2.5 w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                跳过引导 · Esc
              </button>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function OnboardingTrigger({
  onClick,
  label = "使用引导",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <HelpCircle size={14} />
      {label}
    </button>
  );
}
