import type { ShaderVariantId } from "@/lib/shader-variants";

export const features = {
  // 门户页滚轮依赖浏览器原生滚动；Lenis 仅首页需要时可再打开
  smoothScroll: false,
} as const;

export const SHADER_VARIANT_DEFAULT: ShaderVariantId = "warm";
