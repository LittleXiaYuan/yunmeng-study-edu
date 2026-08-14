"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";

export function NumberTicker(props: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? props.value : 0);
  const [display, setDisplay] = useState(reduced ? props.value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(props.value);
      return;
    }
    const controls = animate(motionValue, props.value, {
      duration: 0.9,
      ease: "easeOut",
    });
    const unsubscribe = motionValue.on("change", (latest) =>
      setDisplay(Math.round(latest)),
    );
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [motionValue, props.value, reduced]);

  return <span className={props.className}>{display}</span>;
}
