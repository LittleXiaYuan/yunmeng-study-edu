"use client";

import { CheckCircle2, Circle, Save, Sparkles, Zap } from "lucide-react";
import { useSession } from "@/components/session-provider";
import {
  Callout,
  fieldCls,
  primaryBtnCls,
  secondaryBtnCls,
  StatusBadge,
} from "./page-kit";

const PRESETS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    base_url: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  {
    id: "openai",
    label: "OpenAI",
    base_url: "https://api.openai.com",
    model: "gpt-4o-mini",
  },
  {
    id: "ollama",
    label: "本机 Ollama",
    base_url: "http://127.0.0.1:11434",
    model: "qwen2.5:7b",
  },
] as const;

/**
 * LLM 网关配置：预设一键填充 + 明确状态。
 * Base URL 不要带 /v1（服务端会拼 /v1/chat/completions）。
 */
export function LLMConfigPanel() {
  const { llmConfig, setLLMConfig, saveLLMConfig, busy } = useSession();

  const ready = Boolean(
    llmConfig.enabled && llmConfig.base_url?.trim() && llmConfig.model?.trim(),
  );

  function applyPreset(p: (typeof PRESETS)[number]) {
    setLLMConfig({
      ...llmConfig,
      base_url: p.base_url,
      model: p.model,
      enabled: true,
    });
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Sparkles size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              大模型网关
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              OpenAI 兼容接口。关闭后全平台走规则兜底，仍可登录演示。
            </p>
          </div>
        </div>
        <StatusBadge tone={ready ? "ok" : llmConfig.enabled ? "warn" : "neutral"}>
          {ready ? "已启用" : llmConfig.enabled ? "信息不完整" : "未启用"}
        </StatusBadge>
      </div>

      <Callout tone="info" title="DeepSeek 推荐写法">
        地址填 <code className="rounded bg-background px-1">https://api.deepseek.com</code>
        （不要加 <code className="rounded bg-background px-1">/v1</code>
        ），模型填{" "}
        <code className="rounded bg-background px-1">deepseek-chat</code>。
      </Callout>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          一键预设
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={secondaryBtnCls + " !py-1.5 !text-xs"}
            >
              <Zap size={13} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          接口地址 (base_url)
        </span>
        <input
          className={fieldCls}
          value={llmConfig.base_url}
          onChange={(e) =>
            setLLMConfig({ ...llmConfig, base_url: e.target.value })
          }
          placeholder="https://api.deepseek.com"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          模型 ID (model)
        </span>
        <input
          className={fieldCls}
          value={llmConfig.model ?? ""}
          onChange={(e) =>
            setLLMConfig({ ...llmConfig, model: e.target.value })
          }
          placeholder="deepseek-chat"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          API 密钥
        </span>
        <input
          type="password"
          className={fieldCls}
          value={llmConfig.api_key ?? ""}
          onChange={(e) =>
            setLLMConfig({ ...llmConfig, api_key: e.target.value })
          }
          placeholder="sk-…（留空则沿用已保存密钥）"
          autoComplete="off"
        />
      </label>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={llmConfig.enabled}
          onChange={(e) =>
            setLLMConfig({ ...llmConfig, enabled: e.target.checked })
          }
          className="h-4 w-4"
        />
        <span className="flex items-center gap-1.5">
          {llmConfig.enabled ? (
            <CheckCircle2 size={15} className="text-success" />
          ) : (
            <Circle size={15} className="text-muted-foreground" />
          )}
          启用 LLM（关闭后走规则引擎）
        </span>
      </label>

      {llmConfig.updated_at && (
        <p className="text-xs text-muted-foreground">
          上次更新：{new Date(llmConfig.updated_at).toLocaleString("zh-CN")}
        </p>
      )}

      <button
        type="button"
        onClick={saveLLMConfig}
        disabled={busy === "llm-save"}
        className={primaryBtnCls}
      >
        <Save size={16} />
        {busy === "llm-save" ? "保存中…" : "保存并生效"}
      </button>
    </div>
  );
}
