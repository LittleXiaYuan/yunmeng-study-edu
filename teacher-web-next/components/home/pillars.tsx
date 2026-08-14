"use client";

import { motion, useInView } from "motion/react";
import { Brain, Search, Unlock, type LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { RevealHeadline } from "@/components/reveal-headline";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;

interface Pillar {
  tag: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

const PILLARS: Pillar[] = [
  {
    tag: "01 — 信任分",
    title: "动态解锁式辅导",
    body: "帮助并非无条件给出，而是随学生展示出的理解程度分级解锁：从只提问，到给提示、给线索，直到完整讲解。",
    icon: Unlock,
  },
  {
    tag: "02 — 检索",
    title: "RAG 为引导提供依据",
    body: "教案上传后即进入基于关键词的检索索引，TutorAgent 的每一次提问都能追溯到具体的教材出处，而非凭空生成。",
    icon: Search,
  },
  {
    tag: "03 — 反思",
    title: "元认知训练",
    body: "提问式引导迫使学生复盘自己的思路，系统记录反思等级与思维风格，让「学会学习」本身可被追踪、可被量化。",
    icon: Brain,
  },
];

export function Pillars(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.25 });

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-background text-foreground"
      aria-labelledby="pillars-heading"
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
              核心能力
            </motion.span>
          </div>

          <div className="col-span-7 col-start-6 max-[1100px]:col-span-12 max-[1100px]:col-start-1 max-[850px]:col-span-1">
            <RevealHeadline
              id="pillars-heading"
              delay={0.05}
              className="text-balance text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[0.85] tracking-tight"
            >
              云雀教学 Agent 建立在三项核心能力之上。
            </RevealHeadline>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.18 }}
              className="mt-6 max-w-[60ch] text-balance text-xl max-[850px]:text-lg font-light leading-snug text-foreground/60"
            >
              三者环环相扣，把「因材施教」从一句口号变成每一次对话里都在发生的事。
            </motion.p>
          </div>
        </div>

        <div className="mt-20 max-[850px]:mt-12 grid grid-cols-3 gap-5 max-[1100px]:grid-cols-1 max-[1100px]:gap-4">
          {PILLARS.map((pillar, i) => {
            const featured = i === 0;
            return (
              <motion.article
                key={pillar.tag}
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
                    "group relative flex flex-1 flex-col justify-between",
                    "rounded-2xl p-8 max-[850px]:p-6",
                    "min-h-[360px] max-[850px]:min-h-[280px]",
                    "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    featured
                      ? "bg-accent text-accent-foreground"
                      : "bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  <PillarIcon Icon={pillar.icon} featured={featured} />

                  <div>
                    <p
                      className={[
                        "font-mono text-xs uppercase tracking-[0.2em]",
                        featured ? "text-accent-foreground/55" : "text-foreground/45",
                      ].join(" ")}
                    >
                      {pillar.tag}
                    </p>
                    <h3 className="mt-3 text-2xl max-[850px]:text-xl font-medium leading-tight tracking-tight">
                      {pillar.title}
                    </h3>
                    <p
                      className={[
                        "mt-3 text-sm leading-relaxed",
                        featured ? "text-accent-foreground/75" : "text-foreground/60",
                      ].join(" ")}
                    >
                      {pillar.body}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PillarIcon({
  Icon,
  featured,
}: {
  Icon: LucideIcon;
  featured: boolean;
}): ReactNode {
  return (
    <div
      className={[
        "flex h-10 w-10 items-center justify-center rounded-md",
        "transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]",
        "group-hover:rotate-[-6deg] group-hover:scale-[1.05]",
        featured
          ? "bg-accent-foreground/10 text-accent-foreground"
          : "bg-foreground/10 text-foreground",
      ].join(" ")}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} />
    </div>
  );
}
