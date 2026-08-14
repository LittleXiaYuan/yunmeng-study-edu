"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "@/components/session-provider";

const RotatingCards = dynamic(() => import("@/components/rotating-cards"), {
  ssr: false,
});

/** 选课场景：rotating-cards 3D 圆环，卡面直接放课名+教案数。 */
export function CoursesScene({
  currentCourseId,
  onEnter,
  onBack,
}: {
  currentCourseId: string | null;
  /** 进入所选课程（设为当前课程 + 回学习流）。 */
  onEnter: (courseId: string) => void;
  onBack: () => void;
}) {
  const { dashboard } = useSession();

  const courses = useMemo(() => {
    const list = (dashboard?.courses ?? []).filter((c) => !c.archived);
    return list.length
      ? list
      : [{ id: "course_db", name: "数据库原理", class_id: "", archived: false }];
  }, [dashboard]);

  const [active, setActive] = useState(0);

  const cards = courses.map((c, i) => {
    const lessons = (dashboard?.lessons ?? []).filter(
      (l) => l.course_id === c.id && !l.archived,
    ).length;
    const hue = (i * 67) % 360;
    return {
      id: c.id,
      background: `linear-gradient(135deg, hsl(${hue},70%,52%), hsl(${(hue + 40) % 360},72%,42%))`,
      content: (
        <div className="flex h-full flex-col justify-between p-5 text-white">
          <BookOpen size={22} className="opacity-80" />
          <div>
            <div className="text-lg font-semibold leading-tight">{c.name}</div>
            <div className="mt-1 text-xs text-white/80">
              {lessons > 0 ? `${lessons} 份教案资料` : "资料准备中"}
            </div>
          </div>
        </div>
      ),
    };
  });

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 py-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回学习
        </button>
        <span className="text-sm font-semibold">选择课程</span>
        <span className="w-16" />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <RotatingCards
          cards={cards}
          radius={240}
          cardWidth={180}
          cardHeight={240}
          draggable
          autoPlay
          pauseOnHover
          onCardClick={(_card, index) => setActive(index)}
          className="h-full w-full"
        />
      </div>

      <motion.div
        key={courses[active]?.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="shrink-0 pb-6 text-center"
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          {courses[active]?.name}
          {courses[active]?.id === currentCourseId && (
            <span className="ml-2 align-middle text-xs font-medium text-accent">
              · 当前课程
            </span>
          )}
        </h2>
        <button
          onClick={() => {
            const id = courses[active]?.id;
            if (id) onEnter(id);
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
        >
          进入该课程学习
          <ArrowRight size={16} />
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          拖动圆环切换课程
        </p>
      </motion.div>
    </div>
  );
}
