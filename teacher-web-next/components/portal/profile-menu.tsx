"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/components/session-provider";
import { API_BASE_URL } from "@/lib/api";
import {
  roleName,
  studentAttempts,
  studentProfileStats,
} from "@/lib/portal-helpers";

/**
 * 顶栏头像菜单。下拉用 portal + fixed，避免被学生端
 * fixed + overflow:hidden 壳层裁切或被主区盖住（导致无法点「退出登录」）。
 */
export function ProfileMenu({
  align = "end",
  variant = "portal",
  onOpenProfile,
}: {
  align?: "start" | "end";
  variant?: "portal" | "scene";
  onOpenProfile?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, dashboard, logout } = useSession();
  const router = useRouter();

  const isStudent = user?.role === "student";
  const attempts = useMemo(
    () => (isStudent ? studentAttempts(dashboard, user) : []),
    [isStudent, dashboard, user],
  );
  const stats = useMemo(
    () => (isStudent ? studentProfileStats(attempts, dashboard) : null),
    [isStudent, attempts, dashboard],
  );

  useEffect(() => setMounted(true), []);

  const placeMenu = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuW = 288; // w-72
    const gap = 8;
    let left =
      align === "end" ? r.right - menuW : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    let top = r.bottom + gap;
    // 若下方空间不够，往上翻
    const estimatedH = isStudent && stats ? 320 : 160;
    if (top + estimatedH > window.innerHeight - 8) {
      top = Math.max(8, r.top - estimatedH - gap);
    }
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    const onResize = () => placeMenu();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, isStudent]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // 下一帧再挂，避免打开时的同一次 click 立刻关掉
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function doLogout() {
    setOpen(false);
    logout();
    // replace 避免回退又进已登录页
    router.replace("/login");
  }

  const initials = (user?.name || user?.username || "?")[0];

  const menu =
    open && mounted && pos
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: 288,
                zIndex: 200,
              }}
              className={
                "origin-top overflow-hidden rounded-xl border shadow-xl " +
                (variant === "scene"
                  ? "border-border bg-card/95 backdrop-blur-md"
                  : "border-border bg-card")
              }
            >
              <div className="flex items-center gap-3 border-b border-border p-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-base font-semibold text-white">
                  {user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE_URL}${user.avatar_url}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-sm font-semibold">
                      {user?.name || user?.username}
                    </strong>
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {roleName(user?.role ?? "")}
                    </span>
                  </div>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{user?.username}
                  </span>
                </div>
              </div>

              {isStudent && stats && (
                <div className="border-b border-border p-3">
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    <MiniStat label="信任分" value={stats.score} />
                    <MiniStat
                      label="理解程度"
                      value={stats.understandingScore}
                    />
                    <MiniStat label="迭代" value={stats.revisions} />
                  </div>
                  <p className="mb-3 truncate px-0.5 text-[11px] text-muted-foreground">
                    风格：{stats.style}
                  </p>
                  {stats.weakness.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground">
                      {stats.weakness.slice(0, 2).map((w) => (
                        <li key={w} className="truncate">
                          · {w}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenProfile?.();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <UserIcon size={13} />
                    查看完整画像
                  </button>
                </div>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={doLogout}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
              >
                <LogOut size={15} />
                退出登录
              </button>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="个人信息"
        className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
      >
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_BASE_URL}${user.avatar_url}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </button>
      {menu}
    </>
  );
}

function MiniStat({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-1.5 py-2 text-center">
      <div className="truncate text-sm font-semibold tabular-nums">
        {text ?? value}
      </div>
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
