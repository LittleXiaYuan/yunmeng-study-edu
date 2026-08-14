"use client";

import { motion, useInView, type Transition } from "motion/react";
import { useRef, type ReactNode } from "react";

interface RevealHeadlineProps {

  children: string;

  as?: "h1" | "h2" | "h3";

  className?: string;

  id?: string;

  stagger?: number;

  delay?: number;

  amount?: number;

  mutedFrom?: number;
}

export function RevealHeadline({
  children,
  as: Tag = "h2",
  className,
  id,
  stagger = 0.07,
  delay = 0,
  amount = 0.5,
  mutedFrom,
}: RevealHeadlineProps): ReactNode {
  const ref = useRef<HTMLHeadingElement>(null);

  const inView = useInView(ref, { once: true, amount });

  const words = children.split(/(\s+)/);

  const blockTransition: Transition = {
    duration: 0.7,
    ease: [0.22, 1, 0.36, 1],
  };

  return (
    <Tag ref={ref} id={id} className={className}>
      {words.map((token, i) => {

        if (/^\s+$/.test(token)) {

          return <span key={`s-${i}`}> </span>;
        }

        const wordIndex = words
          .slice(0, i)
          .filter((t) => !/^\s+$/.test(t)).length;
        const wordDelay = delay + wordIndex * stagger;

        const isMuted = mutedFrom !== undefined && wordIndex >= mutedFrom;

        return (
          <span
            key={`w-${i}`}
            className="relative inline-block overflow-hidden align-baseline pb-[0.15em]"
          >
            <span
              className={[
                "relative",
                isMuted ? "text-foreground/35" : "",
              ].join(" ")}
            >
              {token}
            </span>

            <motion.span
              aria-hidden
              initial={{ y: "0%" }}
              animate={inView ? { y: "110%" } : { y: "0%" }}
              transition={{ ...blockTransition, delay: wordDelay }}
              className="absolute inset-x-0 -top-[0.05em] -bottom-[0.2em] bg-foreground will-change-transform"
            />
          </span>
        );
      })}
    </Tag>
  );
}
