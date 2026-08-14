"use client";

import { StudentCelebrate } from "./student-celebrate";
import type { HomeworkTask } from "@/lib/types";

/** 通关庆祝：主 CTA 优先衔接下一项任务。 */
export function CelebrateScene({
  homework,
  onProfile,
  onAsk,
  nextHomework,
  onNext,
}: {
  homework: HomeworkTask;
  onProfile: () => void;
  onAsk: () => void;
  nextHomework?: HomeworkTask | null;
  onNext?: () => void;
}) {
  return (
    <div className="pb-8">
      <StudentCelebrate
        homework={homework}
        onProfile={onProfile}
        onChat={onAsk}
        nextHomework={nextHomework}
        onNext={onNext}
      />
    </div>
  );
}
