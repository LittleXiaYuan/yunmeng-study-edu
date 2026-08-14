"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RollingArrow } from "@/components/arrow-chip";
import { useTheme } from "next-themes";
import { useEffect, useRef, type ReactNode } from "react";
import { WaveShader, type WaveParams, type WaveShaderHandle } from "@/components/wave-shader";

interface Step {
  eyebrow: string;
  body: string;
}

const STEPS: Step[] = [
  {
    eyebrow: "问题",
    body: "传统答疑要么直接给答案，要么套用一刀切的模板，学生真实的思维过程和薄弱点很难被看见。",
  },
  {
    eyebrow: "方法",
    body: "云雀教学 Agent 把教案解析、分步引导、评分诊断与班级洞察统一成一条自我进化的教学闭环。",
  },
  {
    eyebrow: "成效",
    body: "学生在被追问中完成真正的推理，教师能看到可追踪的成长曲线，因材施教变成每天可用的看板。",
  },
];

const REVEAL = 0.7;
const DWELL = 0.3;
const STEP_DURATION = REVEAL + DWELL;

const STEP_PRESETS: WaveParams[] = [
  {
    amp: 0.16,
    freq: 1.0,
    complexity: 0.85,
    speed: 0.55,
    thickness: 0.07,
    hue: 0.05,
    curve: -0.18,
    warp: 0.10,
    chroma: 0.65,
    bias: 0.04,
  },
  {
    amp: 0.26,
    freq: 0.45,
    complexity: 0.45,
    speed: 0.40,
    thickness: 0.11,
    hue: 0.30,
    curve: 0.22,
    warp: 0.03,
    chroma: 0.90,
    bias: -0.02,
  },
  {
    amp: 0.10,
    freq: 0.32,
    complexity: 0.20,
    speed: 0.22,
    thickness: 0.16,
    hue: 0.65,
    curve: 0.05,
    warp: 0.0,
    chroma: 0.95,
    bias: 0.0,
  },
];

export function ValueProp(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordRefs = useRef<(HTMLSpanElement | null)[][]>(STEPS.map(() => []));
  const waveRef = useRef<WaveShaderHandle>(null);

  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const section = sectionRef.current;
    const pin = pinRef.current;
    const bar = progressBarRef.current;
    if (!section || !pin || !bar) return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.ticker.lagSmoothing(0);

    const isDark = resolvedTheme === "dark";
    const DIM = isDark ? "rgba(250,250,250,0.18)" : "rgba(10,10,10,0.20)";
    const BRIGHT = isDark ? "rgba(250,250,250,1)" : "rgba(10,10,10,1)";

    const SCROLL_PER_STEP = window.innerHeight;
    const totalScroll = SCROLL_PER_STEP * STEPS.length;

    gsap.set(bar, { scaleX: 0, transformOrigin: "0 0" });
    stepRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, { autoAlpha: i === 0 ? 1 : 0 });
    });
    wordRefs.current.forEach((words) => {
      words.forEach((w) => {
        if (w) gsap.set(w, { color: DIM });
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${totalScroll}`,
        scrub: true,
        pin: pin,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          gsap.set(bar, { scaleX: self.progress });
        },
      },
    });

    const waveShape: WaveParams = { ...STEP_PRESETS[0]! };
    const pushWave = () => waveRef.current?.setParams(waveShape);

    STEPS.forEach((_, i) => {
      const stepEl = stepRefs.current[i];
      const words = wordRefs.current[i] ?? [];
      if (!stepEl) return;

      const stepStart = i * STEP_DURATION;

      if (i > 0) {
        const prev = stepRefs.current[i - 1];
        if (prev) {
          tl.to(prev, { autoAlpha: 0, duration: 0.15, ease: "none" }, stepStart - 0.15);
        }
        tl.to(stepEl, { autoAlpha: 1, duration: 0.15, ease: "none" }, stepStart - 0.15);

        const target = STEP_PRESETS[i]!;
        tl.to(
          waveShape,
          {
            amp: target.amp,
            freq: target.freq,
            complexity: target.complexity,
            speed: target.speed,
            thickness: target.thickness,
            hue: target.hue,
            curve: target.curve,
            warp: target.warp,
            chroma: target.chroma,
            bias: target.bias,
            duration: STEP_DURATION,
            ease: "power2.inOut",
            onUpdate: pushWave,
          },
          stepStart - STEP_DURATION * 0.5,
        );
      }

      const perWord = REVEAL / Math.max(words.length, 1);
      words.forEach((wEl, wi) => {
        if (!wEl) return;
        tl.to(
          wEl,
          {
            color: BRIGHT,
            duration: perWord,
            ease: "none",
          },
          stepStart + wi * perWord,
        );
      });

      tl.to({}, { duration: DWELL }, stepStart + REVEAL);
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [resolvedTheme]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-background text-foreground"
      aria-label="研究背景"
    >
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] z-0">
          <WaveShader ref={waveRef} dark={resolvedTheme === "dark"} initialParams={STEP_PRESETS[0]} />
        </div>

        <div className="absolute inset-x-0 top-0 h-px bg-foreground/10 z-10">
          <div
            ref={progressBarRef}
            className="h-full w-full bg-accent"
            style={{ transform: "scaleX(0)", transformOrigin: "0 0" }}
          />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 px-10 max-[850px]:px-6 pt-28 max-[850px]:pt-24 max-w-[1680px] mx-auto flex items-end justify-between gap-8">
          <h2 className="max-w-[22ch] text-[clamp(1.5rem,2.4vw,2.25rem)] font-medium leading-[1.15] tracking-tight text-foreground/80">
            一个会追问的教练，而不是一台答案机器。
          </h2>
          <a
            href="#agents"
            className="group hidden max-[850px]:hidden min-[851px]:inline-flex items-center gap-2 rounded-md border border-foreground/[0.08] px-4 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:border-foreground/[0.16] transition-colors whitespace-nowrap shrink-0"
          >
            了解更多
            <RollingArrow iconSize={16} />
          </a>
        </div>

        <div className="absolute inset-0 z-10 px-10 max-[850px]:px-6 pt-72 max-[850px]:pt-60 pb-16 max-w-[1680px] mx-auto pointer-events-none">
          {STEPS.map((step, i) => (
            <div
              key={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="absolute inset-0 px-10 max-[850px]:px-6 pt-72 max-[850px]:pt-60"
              style={{ visibility: "hidden", opacity: 0 }}
            >
              <div className="grid grid-cols-12 gap-8 max-[850px]:grid-cols-1 max-[850px]:gap-6 max-w-[1680px] mx-auto">
                <div className="col-span-3 max-[850px]:col-span-1">
                  <span className="inline-flex items-center rounded-md border border-foreground/[0.08] px-3.5 py-1.5 font-mono text-xs tracking-widest text-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                    <span className="mx-1.5 text-foreground/30">/</span>
                    {String(STEPS.length).padStart(2, "0")}
                  </span>
                  <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-foreground/40">
                    {step.eyebrow}
                  </p>
                </div>

                <p className="col-span-9 max-[850px]:col-span-1 text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[1.1] tracking-tight">
                  {step.body.split("").map((char, wi) => (
                    <span
                      key={wi}
                      ref={(el) => {
                        const arr = wordRefs.current[i];
                        if (arr) arr[wi] = el;
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
