"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function BlurFade(props: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={props.className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.34,
        delay: props.delay || 0,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {props.children}
    </motion.div>
  );
}
