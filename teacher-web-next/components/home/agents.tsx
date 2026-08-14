"use client";

import { motion, useInView } from "motion/react";
import Link from "next/link";
import {
  BookOpen,
  Gauge,
  MessageCircleQuestion,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import { ArrowChip } from "@/components/arrow-chip";
import { RevealHeadline } from "@/components/reveal-headline";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;

interface AgentTile {
  index: string;
  name: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

const AGENT_TILES: AgentTile[] = [
  {
    index: "01.",
    name: "TeacherAgent",
    title: "教案拆解",
    body: "解析上传教案，提炼核心概念、常见难点，并生成一条循序渐进的学习路径。",
    icon: BookOpen,
  },
  {
    index: "02.",
    name: "TutorAgent",
    title: "只提问不给答案",
    body: "元认知教练。始终以引导性提问收尾，逼学生自己完成推理，而不是直接抄答案。",
    icon: MessageCircleQuestion,
  },
  {
    index: "03.",
    name: "EvaluatorAgent",
    title: "评分与诊断",
    body: "评估答案的理解程度与反思深度，识别错误类型，驱动信任分的动态更新。",
    icon: Gauge,
  },
  {
    index: "04.",
    name: "ReflectorAgent",
    title: "班级共性洞察",
    body: "聚合班级与学生数据，沉淀共性问题与教学建议，反哺教师的下一次备课。",
    icon: Users,
  },
];

export function Agents(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      ref={sectionRef}
      id="agents"
      className="relative w-full bg-background text-foreground py-32 max-[850px]:py-24"
      aria-labelledby="agents-heading"
    >
      <div className="max-w-[1680px] mx-auto px-10 max-[850px]:px-6">
        <div className="grid grid-cols-12 gap-x-10 gap-y-6 max-[850px]:grid-cols-1">
          <div className="col-span-3 max-[1100px]:col-span-12 max-[850px]:col-span-1 pt-2">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="inline-flex items-center rounded-md border border-foreground/[0.08] px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest text-foreground/70"
            >
              四 Agent 闭环
            </motion.span>
          </div>

          <div className="col-span-7 col-start-6 max-[1100px]:col-span-12 max-[1100px]:col-start-1 max-[850px]:col-span-1">
            <RevealHeadline
              id="agents-heading"
              delay={0.05}
              className="text-balance text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[0.85] tracking-tight"
            >
              四个角色分工协作，构成一条自我进化的教学闭环。
            </RevealHeadline>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.18 }}
              className="mt-8 max-w-[60ch] text-balance text-base max-[850px]:text-sm leading-relaxed text-foreground/65"
            >
              从教案解析到分步练习、从评分诊断到班级洞察，四个 Agent
              各司其职，又通过信任分与认知记忆首尾相连。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.28 }}
              className="mt-10"
            >
              <Link href="/teacher" className="group inline-flex items-stretch gap-1">
                <span className="px-5 py-3 rounded-md bg-foreground text-background text-xs font-medium tracking-widest uppercase">
                  进入教师工作台
                </span>
                <ArrowChip className="bg-foreground text-background" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mt-24 max-[850px]:mt-16 grid grid-cols-4 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
        {AGENT_TILES.map((tile, i) => {
          const Icon = tile.icon;
          const shade =
            i === 0
              ? "bg-accent text-accent-foreground"
              : i % 2 === 0
                ? "bg-foreground/[0.08] text-foreground"
                : "bg-foreground/[0.04] text-foreground";
          const bodyTone = i === 0 ? "text-accent-foreground/75" : "text-foreground/60";
          const iconTone = i === 0 ? "text-accent-foreground/85" : "text-foreground/70";
          const indexTone = i === 0 ? "text-accent-foreground/55" : "text-foreground/45";

          return (
            <motion.article
              key={tile.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{
                duration: 0.8,
                ease: easeOutExpo,
                delay: 0.45 + i * 0.08,
              }}
              className="relative flex"
            >
              <div
                className={[
                  "relative flex flex-1 flex-col justify-between",
                  "min-h-[320px] max-[850px]:min-h-[240px]",
                  "p-10 max-[850px]:p-7",
                  "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  shade,
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <Icon className={iconTone} size={48} strokeWidth={0.9} aria-hidden />
                  <span
                    className={[
                      "font-mono text-xs uppercase tracking-[0.2em]",
                      indexTone,
                    ].join(" ")}
                  >
                    {tile.index}
                  </span>
                </div>

                <div>
                  <p
                    className={[
                      "font-mono text-[11px] uppercase tracking-[0.18em]",
                      indexTone,
                    ].join(" ")}
                  >
                    {tile.name}
                  </p>
                  <h3 className="mt-1.5 text-xl max-[850px]:text-lg font-medium leading-tight tracking-tight">
                    {tile.title}
                  </h3>
                  <p className={["mt-3 text-sm leading-relaxed", bodyTone].join(" ")}>
                    {tile.body}
                  </p>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
