"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "@/components/session-provider";

const GradientCarousel = dynamic(
  () => import("@/components/gradient-carousel"),
  { ssr: false },
);

/** 用一个渐变色相生成 SVG data-URI 封面（不依赖外网图）。 */
function coverImage(hue: number): string {
  const c1 = `hsl(${hue},70%,55%)`;
  const c2 = `hsl(${(hue + 40) % 360},75%,45%)`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='800' height='1000' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function CourseCarousel({ onBack }: { onBack: () => void }) {
  const { dashboard } = useSession();

  // 真实课程；为空时给一个默认占位，保证轮播不空
  const courses = useMemo(() => {
    const list = (dashboard?.courses ?? []).filter((c) => !c.archived);
    return list.length
      ? list
      : [{ id: "course_db", name: "数据库原理", class_id: "", archived: false }];
  }, [dashboard]);

  const images = useMemo(
    () => courses.map((_, i) => coverImage((i * 67) % 360)),
    [courses],
  );

  const [index, setIndex] = useState(0);
  const active = courses[Math.min(index, courses.length - 1)];
  const lessonCount = (dashboard?.lessons ?? []).filter(
    (l) => l.course_id === active?.id && !l.archived,
  ).length;

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-5 py-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回学习
        </button>
        <span className="text-sm font-semibold">选择课程</span>
        <span className="w-16" />
      </header>

      {/* 轮播（gradient-carousel 需要一个定尺寸容器） */}
      <div className="relative h-[420px] w-full">
        <GradientCarousel
          images={images}
          className="absolute inset-0"
          cardAspectRatio={0.72}
          onCardChange={setIndex}
          initialIndex={0}
        />
      </div>

      {/* 当前课程信息覆盖层（gradient-carousel 只放图，课名靠这里显示） */}
      <motion.div
        key={active?.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-4 w-full max-w-md px-6 text-center"
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <BookOpen size={13} />
          {index + 1} / {courses.length}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {active?.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lessonCount > 0 ? `${lessonCount} 份教案资料` : "课程资料准备中"}
        </p>

        <button
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
        >
          进入该课程学习
          <ArrowRight size={16} />
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          拖动或滚动切换课程
        </p>
      </motion.div>
    </div>
  );
}
