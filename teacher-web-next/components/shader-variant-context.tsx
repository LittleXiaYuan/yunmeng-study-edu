"use client";

import { SHADER_VARIANT_DEFAULT } from "@/lib/config";
import {
  getVariantById,
  type ShaderVariant,
  type ShaderVariantId,
} from "@/lib/shader-variants";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ShaderVariantContextValue {
  variant: ShaderVariant;
  variantId: ShaderVariantId;
  setVariantId: (id: ShaderVariantId) => void;
}

const ShaderVariantContext = createContext<ShaderVariantContextValue | null>(null);

export function ShaderVariantProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {

  const [variantId, setVariantIdState] = useState<ShaderVariantId>(
    SHADER_VARIANT_DEFAULT,
  );

  const setVariantId = useCallback((id: ShaderVariantId): void => {
    setVariantIdState(id);
  }, []);

  const variant = useMemo(() => getVariantById(variantId), [variantId]);

  const value = useMemo<ShaderVariantContextValue>(
    () => ({ variant, variantId, setVariantId }),
    [variant, variantId, setVariantId],
  );

  return (
    <ShaderVariantContext.Provider value={value}>
      {children}
    </ShaderVariantContext.Provider>
  );
}

export function useShaderVariant(): ShaderVariantContextValue {
  const ctx = useContext(ShaderVariantContext);
  if (ctx) return ctx;

  return {
    variant: getVariantById(SHADER_VARIANT_DEFAULT),
    variantId: SHADER_VARIANT_DEFAULT,
    setVariantId: () => {},
  };
}
