"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { PointerEvent, ReactNode } from "react";

/** 可复用 3D 卡壳：鼠标移动时透视 tilt。接任意 children。 */
export function Card3D({
  children,
  className = "",
  max = 10,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  disabled?: boolean;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), {
    stiffness: 220,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), {
    stiffness: 220,
    damping: 18,
  });

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{
        rotateX: disabled ? 0 : rx,
        rotateY: disabled ? 0 : ry,
        transformStyle: "preserve-3d",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
