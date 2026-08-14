"use client";

import { motion, useInView, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { RevealHeadline } from "@/components/reveal-headline";
import { FAQ_ITEMS, type FaqItem } from "@/lib/faq-data";

const easeOutExpo = [0.33, 1, 0.68, 1] as const;
const easeOutQuart = [0.22, 1, 0.36, 1] as const;

interface RowProps {
  item: FaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  inView: boolean;
}

function Row({ item, index, open, onToggle, inView }: RowProps): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{
        duration: 0.7,
        ease: easeOutExpo,
        delay: 0.25 + index * 0.06,
      }}
      className="border-t border-foreground/[0.08] last:border-b"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group block w-full text-left transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-foreground/[0.03]"
      >
        <div className="relative flex items-center gap-6 px-2 py-7 max-[850px]:py-6">
          <span className="font-mono text-xs uppercase tracking-widest text-foreground/40 tabular-nums shrink-0 w-10 max-[850px]:w-8">
            {String(index + 1).padStart(2, "0")}
          </span>

          <span className="flex-1 text-xl max-[850px]:text-lg font-medium tracking-tight leading-snug">
            {item.q}
          </span>

          <span
            aria-hidden
            className="relative flex h-9 w-9 max-[850px]:h-8 max-[850px]:w-8 shrink-0 items-center justify-center rounded-full border border-foreground/[0.12] text-foreground/70 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:border-foreground/30 group-hover:text-foreground"
          >
            <motion.span
              initial={false}
              animate={{ rotate: open ? 45 : 0 }}
              transition={{ duration: 0.5, ease: easeOutQuart }}
              className="flex items-center justify-center"
            >
              <Plus className="h-4 w-4" strokeWidth={1.6} />
            </motion.span>
          </span>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.55, ease: easeOutQuart },
                opacity: {
                  duration: 0.4,
                  ease: easeOutQuart,
                  delay: open ? 0.08 : 0,
                },
              }}
              className="overflow-hidden"
            >
              <div className="flex gap-6 px-2 pb-8 max-[850px]:pb-6">
                <span className="w-10 max-[850px]:w-8 shrink-0" aria-hidden />
                <p className="max-w-[68ch] text-base max-[850px]:text-sm leading-relaxed text-foreground/65 pr-12">
                  {item.a}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

export function Faq(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="relative w-full bg-background text-foreground"
      aria-labelledby="faq-heading"
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
              常见问题
            </motion.span>
          </div>

          <div className="col-span-7 col-start-6 max-[1100px]:col-span-12 max-[1100px]:col-start-1 max-[850px]:col-span-1">
            <RevealHeadline
              id="faq-heading"
              delay={0.05}
              className="text-balance text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[0.85] tracking-tight"
            >
              在接入之前，老师和同学最常问的问题。
            </RevealHeadline>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.18 }}
              className="mt-6 max-w-[60ch] text-balance text-xl max-[850px]:text-lg font-light leading-snug text-foreground/60"
            >
              涵盖信任分、RAG 出处、LLM 开关与部署方式——如果还有疑问，欢迎直接联系我们的团队。
            </motion.p>
          </div>
        </div>

        <div className="mt-20 max-[850px]:mt-12 grid grid-cols-12 gap-x-10 max-[850px]:grid-cols-1">
          <div className="col-span-10 col-start-2 max-[1100px]:col-span-12 max-[1100px]:col-start-1 max-[850px]:col-span-1">
            <div role="list">
              {FAQ_ITEMS.map((item, i) => (
                <Row
                  key={item.q}
                  item={item}
                  index={i}
                  open={openIndex === i}
                  onToggle={() =>
                    setOpenIndex((prev) => (prev === i ? null : i))
                  }
                  inView={inView}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
