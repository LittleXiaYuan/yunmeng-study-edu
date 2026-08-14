"use client";

import { motion, useInView } from "motion/react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { ArrowChip } from "@/components/arrow-chip";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;

const HEADLINE_LINES = ["让每一次追问，", "都成为一次成长。"] as const;

export function FinalCta(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.35 });

  return (
    <section
      ref={sectionRef}
      id="get-started"
      className="relative w-full bg-background text-foreground"
      aria-labelledby="final-cta-heading"
    >
      <div className="max-w-[1680px] mx-auto px-10 max-[850px]:px-6 pb-32 max-[850px]:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
          transition={{ duration: 1, ease: easeOutExpo }}
          className="relative overflow-hidden rounded-3xl bg-[#02030a] min-h-[520px] max-[850px]:min-h-[420px]"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(65%_60%_at_20%_0%,rgba(99,102,241,0.35),transparent),radial-gradient(55%_50%_at_100%_100%,rgba(34,211,238,0.22),transparent)]"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/10"
          />

          <div className="relative h-full flex flex-col justify-between p-14 max-[850px]:p-8 min-h-[inherit] text-white">
            <motion.h2
              id="final-cta-heading"
              className="max-w-[16ch] text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[0.95] tracking-tight"
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ staggerChildren: 0.12, delayChildren: 0.15 }}
            >
              {HEADLINE_LINES.map((line) => (
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
            </motion.h2>

            <div className="flex items-end justify-between gap-8 max-[850px]:flex-col max-[850px]:items-start mt-10">
              <motion.p
                className="max-w-xl text-3xl max-[850px]:text-base font-regular tracking-tighter leading-snug text-white/75"
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.6 }}
              >
                上传一份教案，立刻拥有一位只提问、不给答案的教学 Agent。免部署试用，随时可关闭
                LLM 回退为规则引擎。
              </motion.p>

              <motion.div
                className="flex items-center gap-3 shrink-0"
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.7 }}
              >
                <Link href="/teacher" className="group inline-flex items-stretch gap-1">
                  <span className="px-5 py-3 rounded-md bg-white text-neutral-900 text-xs font-medium tracking-widest uppercase border border-neutral-900/[0.08]">
                    教师工作台
                  </span>
                  <ArrowChip className="bg-white text-neutral-900" />
                </Link>
                <Link href="/student" className="group inline-flex items-stretch gap-1">
                  <span className="px-5 py-3 rounded-md bg-white/10 text-white text-xs font-medium tracking-widest uppercase border border-white/20">
                    学生端
                  </span>
                  <ArrowChip className="bg-white/10 text-white" />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
