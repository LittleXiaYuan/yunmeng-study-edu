"use client";

import {
  animate,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { ShaderCanvas } from "@/components/shader-canvas";
import { Nav } from "@/components/nav";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;

const START_W = 110;
const START_H = 60;
const FINAL_RADIUS = 24;
const FRAME_INSET = 10;

const SCROLL_RANGE = 80;

const entries: {
  href: string;
  label: string;
  desc: string;
  primary?: boolean;
}[] = [
  { href: "/login", label: "登录", desc: "进入教学服务平台", primary: true },
  { href: "/teacher", label: "教师端", desc: "备课 · 任务 · 课堂" },
  { href: "/student", label: "学生端", desc: "分步练习 · 学习教练" },
];

export function Hero(): ReactNode {
  const progress = useMotionValue(0);

  const { scrollY } = useScroll();
  const rawExit = useTransform(scrollY, [0, SCROLL_RANGE], [0, 1], {
    clamp: true,
  });

  const exit = useSpring(rawExit, {
    stiffness: 120,
    damping: 22,
    mass: 0.4,
  });

  const padding = useTransform(exit, [0, 1], [FRAME_INSET, 0]);

  const width = useTransform(
    progress,
    (p) => `calc(${START_W}px + (100% - ${START_W}px) * ${p})`,
  );
  const height = useTransform(
    progress,
    (p) => `calc(${START_H}px + (100% - ${START_H}px) * ${p})`,
  );

  const borderRadius = useTransform([progress, exit], (latest) => {
    const [p, e] = latest as [number, number];

    const viewportH =
      typeof window !== "undefined" ? window.innerHeight - 20 : 800;
    const h = START_H + (viewportH - START_H) * p;
    const pillRadius = h / 2;

    const PILL_HOLD = 0.4;
    const t = Math.max(0, (p - PILL_HOLD) / (1 - PILL_HOLD));
    const eased = t * t * (3 - 2 * t);

    const entranceRadius = pillRadius * (1 - eased) + FINAL_RADIUS * eased;

    return entranceRadius * (1 - e);
  });

  useEffect(() => {
    const controls = animate(progress, 1, {
      duration: 1.8,
      ease: easeOutExpo,
    });
    return () => controls.stop();
  }, [progress]);

  return (
    <>
      <Nav delay={1.3} />

      <motion.section className="relative w-full h-screen" style={{ padding }}>
        <div className="relative w-full h-full flex items-center justify-center">
          <motion.div
            className="relative overflow-hidden bg-[#02030a]"
            style={{ width, height, borderRadius }}
          >
            <div aria-hidden="true" className="absolute inset-0 w-full h-full">
              <ShaderCanvas />
            </div>

            <motion.div
              className="absolute inset-0 flex flex-col justify-between p-10 pt-40 max-[850px]:p-6 max-[850px]:pt-32 text-white pointer-events-none max-w-[1680px] mx-auto"
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.12, delayChildren: 1.4 }}
            >
              <motion.span
                className="text-xs font-medium uppercase tracking-[0.35em] text-white/70"
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.8, ease: easeOutExpo }}
              >
                云雀教学 Agent
              </motion.span>

              <motion.h1
                className="max-w-[18ch] text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.98] tracking-tight"
                variants={{
                  hidden: {},
                  visible: {},
                }}
                transition={{ staggerChildren: 0.12 }}
              >
                {["AI 智能伴学，", "因材施教。"].map((line) => (
                  <span key={line} className="block overflow-hidden pb-[0.05em]">
                    <motion.span
                      className="block will-change-transform"
                      variants={{
                        hidden: { y: "110%" },
                        visible: { y: "0%" },
                      }}
                      transition={{ duration: 1, ease: easeOutExpo }}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </motion.h1>

              <div className="flex items-end justify-between gap-8 max-[850px]:flex-col max-[850px]:items-start">
                <motion.p
                  className="max-w-xl text-lg font-medium leading-relaxed text-white/85 max-[850px]:text-base"
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.8, ease: easeOutExpo }}
                >
                  教师上传教案，AI 拆解知识点与学习路径；学生在分步引导中完成练习，
                  系统基于信任分动态调整辅导策略。默认覆盖《数据库原理》课程。
                </motion.p>

                <motion.div
                  className="flex flex-wrap items-center gap-3 pointer-events-auto"
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.8, ease: easeOutExpo }}
                >
                  {entries.map((e) => (
                    <Link
                      key={e.href}
                      href={e.href}
                      className={
                        e.primary
                          ? "group inline-flex flex-col rounded-lg bg-white px-6 py-4 text-neutral-900 transition-transform hover:-translate-y-0.5"
                          : "group inline-flex flex-col rounded-lg border border-white/25 px-6 py-4 text-white backdrop-blur-sm transition-colors hover:border-white/60"
                      }
                    >
                      <span className="text-sm font-semibold tracking-wide">
                        {e.label}
                      </span>
                      <span
                        className={
                          e.primary
                            ? "text-xs text-neutral-500"
                            : "text-xs text-white/60"
                        }
                      >
                        {e.desc}
                      </span>
                    </Link>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </>
  );
}
