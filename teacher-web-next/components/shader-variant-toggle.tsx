"use client";

import { useShaderVariant } from "@/components/shader-variant-context";
import { SHADER_VARIANTS, type ShaderVariantId } from "@/lib/shader-variants";
import { AnimatePresence, motion } from "motion/react";
import { Palette } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function ShaderVariantToggle(): ReactNode {
  const { variant, variantId, setVariantId } = useShaderVariant();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent): void => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = useCallback(
    (id: ShaderVariantId): void => {
      setVariantId(id);
    },
    [setVariantId],
  );

  return (

    <div className="fixed bottom-[160px] right-6 z-50">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Shader variant: ${variant.label}. Click to change.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-muted text-foreground opacity-30 shadow-lg transition-opacity duration-300 hover:opacity-100 hover:shadow-xl"
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
          style={{ backgroundColor: variant.swatch }}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={popoverRef}
            role="dialog"
            aria-labelledby={labelId}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: easeOutExpo }}
            className="absolute bottom-12 right-0 min-w-[240px] rounded-xl border border-foreground/[0.08] bg-background p-2 shadow-2xl"
            style={{ originX: 1, originY: 1 }}
          >
            <ul className="flex flex-col gap-0.5">
              {SHADER_VARIANTS.map((v) => {
                const active = v.id === variantId;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => choose(v.id as ShaderVariantId)}
                      className={[
                        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active
                          ? "bg-foreground/[0.06]"
                          : "hover:bg-foreground/[0.04]",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 rounded-md ring-1 ring-foreground/[0.08]"
                        style={{ backgroundColor: v.swatch }}
                      />
                      <span className="flex flex-1 flex-col leading-tight">
                        <span className="text-sm font-medium text-foreground">
                          {v.label}
                        </span>
                        <span className="text-xs text-foreground/55">
                          {v.description}
                        </span>
                      </span>
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
