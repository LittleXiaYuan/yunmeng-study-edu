"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useSession } from "@/components/session-provider";
import type { StudentDraft } from "@/lib/types";
import type { OpenPanel } from "../panel-registry";

interface EditableRow {
  id: string;
  name: string;
  username: string;
  password: string;
}

function newId() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 批量导入学生：粘贴 / 可编辑表格预览 → 确认创建。
 * 生成结果可直接改姓名账号，不再卡在「只读对话框」。
 */
export function StudentImportPanel({
  openPanel,
}: {
  openPanel: OpenPanel;
}) {
  const { dashboard, refresh } = useSession();
  const classes = useMemo(
    () => (dashboard?.classes ?? []).filter((c) => !c.archived),
    [dashboard],
  );

  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [createUser, setCreateUser] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    created: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/15";

  function parsePaste() {
    const parsed = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cols = line.split(/[,\t，]/).map((c) => c.trim());
        return {
          id: newId(),
          name: cols[0] ?? "",
          username: cols[1] ?? "",
          password: cols[2] ?? "",
        };
      })
      .filter((r) => r.name);
    setRows(parsed);
    setResult(null);
  }

  function updateRow(
    id: string,
    field: "name" | "username" | "password",
    value: string,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addEmptyRow() {
    setRows((prev) => [
      ...prev,
      { id: newId(), name: "", username: "", password: "" },
    ]);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0 || running || !classId) return;
    setRunning(true);
    setResult(null);
    setProgress({ done: 0, total: valid.length });
    const drafts: StudentDraft[] = valid.map((r) => ({
      name: r.name.trim(),
      class_id: classId,
      username: r.username.trim(),
      password: r.password.trim(),
      create_user: createUser,
    }));
    const res = await api.bulkCreateStudents(drafts, (done, total) =>
      setProgress({ done, total }),
    );
    setResult(res);
    setRunning(false);
    await refresh();
  }

  return (
    <div className="flex min-h-[320px] flex-col">
      <div data-lenis-prevent className="space-y-4 px-5 py-4">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              导入到班级
            </span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            >
              {classes.length === 0 && <option value="">（暂无班级）</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createUser}
              onChange={(e) => setCreateUser(e.target.checked)}
            />
            同时创建登录账号（默认密码 student123456）
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            1. 粘贴名单（每行：姓名[,账号[,密码]]）
          </span>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"张三\n李四,lisi\n王五,wangwu,pass1234"}
            className="min-h-[100px] w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={parsePaste}
            disabled={!raw.trim()}
            className="btn-ghost self-start !py-1.5 !text-xs"
          >
            解析到下方表格
          </button>
        </label>

        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              2. 可编辑预览 · {rows.filter((r) => r.name.trim()).length} 名
            </span>
            <button
              type="button"
              onClick={addEmptyRow}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} />
              加一行
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              粘贴名单后点「解析」，或手动加行编辑
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-8 px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">姓名 *</th>
                    <th className="px-2 py-2 font-medium">账号</th>
                    <th className="px-2 py-2 font-medium">密码</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={r.id} className="align-middle">
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={inputCls}
                          value={r.name}
                          onChange={(e) =>
                            updateRow(r.id, "name", e.target.value)
                          }
                          placeholder="姓名"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={inputCls}
                          value={r.username}
                          onChange={(e) =>
                            updateRow(r.id, "username", e.target.value)
                          }
                          placeholder="自动"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={inputCls}
                          value={r.password}
                          onChange={(e) =>
                            updateRow(r.id, "password", e.target.value)
                          }
                          placeholder="默认"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRow(r.id)}
                          aria-label="删除行"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {running && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            正在创建 {progress.done}/{progress.total}…
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
              <CheckCircle2 size={14} />
              成功创建 {result.created} 名
              {result.failed > 0 ? `，失败 ${result.failed} 名` : ""}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={13} />
                  失败明细
                </div>
                <ul className="flex flex-col gap-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={handleImport}
          disabled={
            rows.filter((r) => r.name.trim()).length === 0 ||
            running ||
            !classId
          }
          className="btn-brand flex-1"
        >
          <Upload size={16} />
          {running
            ? "导入中…"
            : `确认创建 ${rows.filter((r) => r.name.trim()).length} 名`}
        </button>
        {result && result.created > 0 && (
          <button
            type="button"
            onClick={() => openPanel("student-list")}
            className="btn-ghost"
          >
            查看名单
          </button>
        )}
      </div>
    </div>
  );
}
