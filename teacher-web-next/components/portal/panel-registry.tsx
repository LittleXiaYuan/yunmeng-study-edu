"use client";

import type { ReactNode } from "react";
import type { PortalMode } from "@/lib/commands";
import { HomeworkForm } from "./homework-form";
import { OverviewView, MaterialsUploadForm } from "./views";
import { LLMConfigPanel } from "./llm-config-panel";
import { StudentListPanel } from "./roster/student-list-panel";
import { StudentImportPanel } from "./roster/student-import-panel";
import { StudentDetailPanel } from "./roster/student-detail-panel";
import { ClassProfilePanel } from "./roster/class-profile-panel";
import { OrgAdminPanel } from "./roster/org-admin-panel";

/** 一次抽屉里正在展示的面板实例（kind + 运行时 props）。 */
export interface PanelInstance {
  kind: string;
  props?: Record<string, unknown>;
}

/** 打开面板的回调签名，透传给对话主体（AgentWorkbench）与各面板内部。 */
export type OpenPanel = (kind: string, props?: Record<string, unknown>) => void;

/** 面板渲染上下文：让面板既能再开子面板（堆叠），也能主动关闭自己。 */
export interface PanelContext {
  mode: PortalMode;
  props?: Record<string, unknown>;
  openPanel: OpenPanel;
  close: () => void;
}

interface PanelDef {
  title: string;
  subtitle?: string;
  render: (ctx: PanelContext) => ReactNode;
}

/**
 * 面板注册表：kind → 标题/副标题/渲染器。
 * 命令集里的 panel 字段与 handleChoice 的 open_panel 都通过 kind 命中这里。
 * 后续 Step 4–7 只需往这里加条目，ChatShell / PanelDock 无需改动。
 */
const PANELS: Record<string, PanelDef> = {
  "org-admin": {
    title: "学校与组织",
    subtitle: "学校 CRUD · 按校看班级（仅超管）",
    render: () => <OrgAdminPanel />,
  },
  overview: {
    title: "平台总览",
    subtitle: "资料 / 任务 / 学生 / 检索 KPI",
    render: ({ mode }) => (
      <div className="px-5 py-5">
        <OverviewView role={mode} />
      </div>
    ),
  },
  "llm-config": {
    title: "系统配置",
    subtitle: "云雀 LLM 网关连接",
    render: () => <LLMConfigPanel />,
  },
  "student-list": {
    title: "学生名单",
    subtitle: "搜索 / 分页浏览 · 点行看学情",
    render: ({ openPanel, props }) => (
      <StudentListPanel
        openPanel={openPanel}
        classId={typeof props?.classId === "string" ? props.classId : undefined}
      />
    ),
  },
  "student-import": {
    title: "批量导入学生",
    subtitle: "粘贴 / CSV → 预览 → 批量建号",
    render: ({ openPanel }) => <StudentImportPanel openPanel={openPanel} />,
  },
  "student-detail": {
    title: "学生学情",
    subtitle: "信任分 / 弱点 / 学习轨迹",
    render: ({ props }) =>
      typeof props?.id === "string" ? (
        <StudentDetailPanel
          id={props.id}
          name={typeof props?.name === "string" ? props.name : undefined}
        />
      ) : (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          缺少学生 ID
        </div>
      ),
  },
  "class-profile": {
    title: "班级画像",
    subtitle: "共性问题 / 均分 / 学生学情",
    render: ({ openPanel }) => <ClassProfilePanel openPanel={openPanel} />,
  },
  "homework-form": {
    title: "发布作业",
    subtitle: "填写后发布，学生端立即可见",
    render: ({ close }) => (
      <HomeworkForm embed compact onDone={close} />
    ),
  },
  "materials-upload": {
    title: "导入教案",
    subtitle: "PDF / ZIP / 文本 → 检索库",
    render: ({ close }) => <MaterialsUploadForm onDone={close} />,
  },
};

export function hasPanel(kind: string): boolean {
  return kind in PANELS;
}

export function panelTitle(kind: string): { title: string; subtitle?: string } {
  const def = PANELS[kind];
  return def
    ? { title: def.title, subtitle: def.subtitle }
    : { title: "面板", subtitle: kind };
}

export function renderPanel(kind: string, ctx: PanelContext): ReactNode {
  const def = PANELS[kind];
  if (!def) {
    return (
      <div className="px-5 py-6 text-sm text-muted-foreground">
        未找到面板：{kind}
      </div>
    );
  }
  return def.render(ctx);
}
