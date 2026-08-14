"use client";

import { motion, useInView } from "motion/react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { ArrowChip } from "@/components/arrow-chip";
import { RevealHeadline } from "@/components/reveal-headline";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;

interface Scenario {
  name: string;
  tag: string;
  body: string;
  cta: { label: string; href: string };
  features: string[];
  featured?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    name: "面向学生",
    tag: "自主学习",
    body: "上传的教案不是终点，而是起点。分步任务配合只提问不给答案的追问，逼自己完成推理，而不是抄一个答案。",
    cta: { label: "进入学生端", href: "/student" },
    features: [
      "分步任务，逐层揭示思路",
      "信任分越高解锁的帮助越多",
      "认知画像可追踪学习风格与薄弱点",
    ],
  },
  {
    name: "面向教师",
    tag: "备课与洞察",
    body: "上传教案即完成知识点拆解，批改与诊断交给 EvaluatorAgent，班级共性问题由 ReflectorAgent 定期沉淀。",
    cta: { label: "进入教师工作台", href: "/teacher" },
    features: [
      "教案自动拆解为概念、难点与学习路径",
      "自动评分与错误类型诊断",
      "班级共性问题与教学建议聚合",
    ],
    featured: true,
  },
  {
    name: "面向院校",
    tag: "私有化部署",
    body: "默认覆盖《数据库原理》等本科课程，教学闭环与具体学科无关，可扩展到其他课程，数据保留在本地。",
    cta: { label: "了解部署方式", href: "#faq" },
    features: [
      "支持私有化部署，数据不出校",
      "教学闭环可扩展到任意学科",
      "LLM 可关闭，启发式兜底保证可用",
    ],
  },
];

export function Scenarios(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      ref={sectionRef}
      id="scenarios"
      className="relative w-full bg-background text-foreground"
      aria-labelledby="scenarios-heading"
    >
      <div className="max-w-[1680px] mx-auto px-10 max-[850px]:px-6 py-32 max-[850px]:py-24">
        <div className="grid grid-cols-12 gap-x-10 gap-y-6 max-[850px]:grid-cols-1">
          <div className="col-span-3 max-[1100px]:col-span-12 max-[850px]:col-span-1 pt-2">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="inline-flex items-center rounded-md border border-foreground/[0.08] px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest text-foreground/70"
            >
              适用场景
            </motion.span>
          </div>

          <div className="col-span-7 col-start-6 max-[1100px]:col-span-12 max-[1100px]:col-start-1 max-[850px]:col-span-1">
            <RevealHeadline
              id="scenarios-heading"
              delay={0.05}
              className="text-balance text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[0.85] tracking-tight"
            >
              一套教学闭环，服务学生、教师与院校三方。
            </RevealHeadline>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.18 }}
              className="mt-6 max-w-[60ch] text-balance text-xl max-[850px]:text-lg font-light leading-snug text-foreground/60"
            >
              同一套信任分与四 Agent 机制，在不同角色的视角里呈现出不同的价值。
            </motion.p>
          </div>
        </div>

        <div className="mt-20 max-[850px]:mt-12 grid grid-cols-3 gap-5 max-[1100px]:grid-cols-1 max-[1100px]:gap-4">
          {SCENARIOS.map((scenario, i) => (
            <motion.article
              key={scenario.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{
                duration: 0.8,
                ease: easeOutExpo,
                delay: 0.25 + i * 0.08,
              }}
              className="relative flex"
            >
              <div
                className={[
                  "group relative flex flex-1 flex-col",
                  "rounded-2xl p-10 max-[850px]:p-7",
                  "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  scenario.featured
                    ? "bg-accent text-accent-foreground"
                    : "bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.06]",
                ].join(" ")}
              >
                <div>
                  <p
                    className={[
                      "font-mono text-xs uppercase tracking-[0.2em]",
                      scenario.featured
                        ? "text-accent-foreground/55"
                        : "text-foreground/45",
                    ].join(" ")}
                  >
                    {scenario.tag}
                  </p>
                  <h3 className="mt-3 text-3xl max-[850px]:text-2xl font-medium leading-tight tracking-tight">
                    {scenario.name}
                  </h3>

                  <p
                    className={[
                      "mt-6 text-sm leading-relaxed max-w-[42ch]",
                      scenario.featured
                        ? "text-accent-foreground/75"
                        : "text-foreground/60",
                    ].join(" ")}
                  >
                    {scenario.body}
                  </p>
                </div>

                <ul className="mt-10 space-y-4">
                  {scenario.features.map((feature) => (
                    <li
                      key={feature}
                      className={[
                        "flex items-start gap-3 text-sm",
                        scenario.featured
                          ? "text-accent-foreground/85"
                          : "text-foreground/85",
                      ].join(" ")}
                    >
                      <Check
                        className={[
                          "mt-0.5 h-4 w-4 shrink-0",
                          scenario.featured
                            ? "text-accent-foreground/60"
                            : "text-foreground/60",
                        ].join(" ")}
                        strokeWidth={1.6}
                        aria-hidden
                      />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 pt-2">
                  <Link
                    href={scenario.cta.href}
                    className="group/cta inline-flex items-stretch gap-1"
                  >
                    <span
                      className={[
                        "px-5 py-3 rounded-md text-xs font-medium tracking-widest uppercase",
                        scenario.featured
                          ? "bg-accent-foreground text-accent"
                          : "bg-foreground text-background",
                      ].join(" ")}
                    >
                      {scenario.cta.label}
                    </span>
                    <ArrowChip
                      className={
                        scenario.featured
                          ? "bg-accent-foreground text-accent"
                          : "bg-foreground text-background"
                      }
                      name="cta"
                    />
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
