"use client";

import {
  AlertTriangle,
  ChevronRight,
  Gauge,
  Lightbulb,
  Loader2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { currentCourse } from "@/lib/portal-helpers";
import type { StudentListItem } from "@/lib/types";
import type { OpenPanel } from "../panel-registry";

function Metric({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-brand/25 bg-brand-soft p-5"
          : "surface-card p-5"
      }
    >
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <div
        className={
          accent
            ? "text-3xl font-semibold tabular-nums tracking-tight text-trust"
            : "text-3xl font-semibold tabular-nums tracking-tight"
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

/**
 * 班级学情：大指标卡 + 共性问题 + 本班学生（点行下钻）
 */
export function ClassProfilePanel({ openPanel }: { openPanel: OpenPanel }) {
  const { dashboard } = useSession();

  const course = currentCourse(dashboard);
  const classId = course?.class_id ?? "";
  const className =
    (dashboard?.classes ?? []).find((c) => c.id === classId)?.name ??
    course?.name ??
    "本班";

  const commonProblems = dashboard?.common_problems ?? [];
  const avgTrust = Math.round(dashboard?.average_trust ?? 0);
  const avgUnderstanding = Math.round(dashboard?.average_understanding ?? 0);

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listStudents({
        page: 1,
        pageSize: 100,
        classId: classId || undefined,
        archived: false,
      });
      setStudents(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const trustHint = useMemo(() => {
    if (avgTrust >= 85) return "整体已达可解释层";
    if (avgTrust >= 70) return "多数进入部分披露层";
    if (avgTrust >= 50) return "整体处于提示层";
    return "整体仍在仅提问层";
  }, [avgTrust]);

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div>
        <p className="eyebrow">班级学情</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {className}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          共性问题与均分来自学生练习汇总；点学生可看个人学情。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric
          icon={<Gauge size={16} />}
          label="平均信任分"
          value={avgTrust || "—"}
          hint={avgTrust ? trustHint : "暂无数据"}
          accent
        />
        <Metric
          icon={<Gauge size={16} />}
          label="平均理解分"
          value={avgUnderstanding || "—"}
        />
        <Metric
          icon={<Users size={16} />}
          label="在读学生"
          value={students.length}
          hint={course?.name}
        />
      </div>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <AlertTriangle size={16} className="text-amber-500" />
          班级共性问题
        </h3>
        {commonProblems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            暂无共性问题（学生完成任务后自动汇总）
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {commonProblems.slice(0, 8).map((p, i) => (
              <li
                key={`${p}-${i}`}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3.5 text-sm leading-relaxed"
              >
                <Lightbulb
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-500"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users size={16} className="text-brand" />
          本班学生
        </h3>
        {error && (
          <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            加载中…
          </div>
        ) : students.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            本班暂无学生
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {students.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    openPanel("student-detail", { id: s.id, name: s.name })
                  }
                  className="surface-card flex w-full items-center gap-3 p-4 text-left transition hover:border-brand/35"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                    {s.name.slice(0, 1) || "学"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {s.name}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
