"use client";

import { useShaderVariant } from "@/components/shader-variant-context";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

export interface WaveParams {

  amp: number;

  freq: number;

  complexity: number;

  speed: number;

  thickness: number;

  hue: number;

  curve: number;

  warp: number;

  chroma: number;

  bias: number;
}

export interface WaveShaderHandle {
  setParams: (next: Partial<WaveParams>) => void;
  getParams: () => WaveParams;
}

const VERT =  `
attribute vec2 position;
varying vec2 v;
void main(){
  v = position;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG =  `
precision mediump float;
varying vec2 v;
uniform float t;
uniform vec2 r;

uniform float u_amp;
uniform float u_freq;
uniform float u_complex;
uniform float u_speed;
uniform float u_thick;
uniform float u_hue;
uniform float u_curve;
uniform float u_warp;
uniform float u_chroma;
uniform float u_bias;

uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;

uniform float u_dark;

float h(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float n2(vec2 u){
  vec2 i = floor(u);
  vec2 f = fract(u);
  f = f*f*(3.0 - 2.0*f);
  float a = h(i);
  float b = h(i + vec2(1.0, 0.0));
  float c = h(i + vec2(0.0, 1.0));
  float d = h(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float grain(vec2 p){
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + t * 9.13) * 43758.5453) - 0.5;
}

vec2 centerline(float x, float phase, float yOffset, float thickMul){
  float xf = x * u_freq;
  float ts = t * u_speed;
  float w1 = sin(xf + ts + phase) * u_amp;
  float w2 = sin(xf * 2.3 + ts * 0.7 + phase * 1.7) * u_amp * 0.4 * u_complex;

  float xn = x * 0.5;
  float bow = u_curve * (xn * xn - 0.33);

  float warp = (n2(vec2(x * 0.45 + ts * 0.25, phase * 0.5)) - 0.5) * u_warp;

  float yC = w1 + w2 + bow + warp + u_bias + yOffset;

  float pinch = 0.55 + 0.45 * sin(xf * 0.6 + ts * 0.4 + phase);
  return vec2(yC, thickMul * pinch);
}

float band(vec2 p, float phase, float yOffset, float thickMul){
  vec2 cl = centerline(p.x, phase, yOffset, thickMul);
  float th = u_thick * cl.y;
  float d = abs(p.y - cl.x);
  return 1.0 - smoothstep(th * 0.55, th * 1.6, d);
}

vec3 palette(float k){
  float kk = 2.0 * abs(fract(k * 0.5) - 0.5);

  float seg = kk * 4.0;
  float si = floor(seg);
  float sf = seg - si;
  sf = sf * sf * (3.0 - 2.0 * sf);

  vec3 a, b;
  if (si < 0.5)      { a = u_c0; b = u_c1; }
  else if (si < 1.5) { a = u_c1; b = u_c2; }
  else if (si < 2.5) { a = u_c2; b = u_c3; }
  else               { a = u_c3; b = u_c4; }
  return mix(a, b, sf);
}

void main(){
  vec2 uv = v;
  uv.x *= r.x / r.y;

  const int LAYERS = 5;
  float dens = 0.0;
  float colorAccum = 0.0;
  float colorWeight = 0.0;

  for (int i = 0; i < LAYERS; i++) {
    float fi = float(i);
    float phase = fi * 1.61803;
    float yOff = (fi - 2.0) * u_thick * 0.55;
    float thickMul = mix(1.0, 0.4, fi / float(LAYERS - 1));

    float a = band(uv, phase, yOff, thickMul);
    dens += a;

    float k = u_hue
            + uv.x * 0.06
            + fi * 0.035
            + t * 0.010;
    colorAccum += a * k;
    colorWeight += a;
  }

  float alpha = 1.0 - exp(-dens * 3.2);

  float kAvg = colorWeight > 1e-4 ? colorAccum / colorWeight : u_hue;

  vec3 ribbon = palette(kAvg);

  float core = smoothstep(1.0, 2.4, dens);
  float bloom = smoothstep(0.5, 1.0, dens) * (1.0 - smoothstep(1.0, 1.8, dens));

  vec3 hi = mix(palette(kAvg + 0.05), vec3(1.0), 0.25);
  ribbon = mix(ribbon, hi, core * 0.45);
  vec3 sheen = palette(kAvg + 0.20);
  ribbon += sheen * bloom * 0.20;
  ribbon = min(ribbon, vec3(1.0));

  float g = grain(gl_FragCoord.xy);
  ribbon += g * 0.035 * alpha;

  vec3 bg = mix(vec3(1.0), vec3(0.039), u_dark);

  vec3 col = mix(bg, ribbon, alpha);

  gl_FragColor = vec4(col, 1.0);
}
`;

interface Props {
  className?: string;

  initialParams?: Partial<WaveParams> | undefined;

  dark?: boolean;

  ref?: Ref<WaveShaderHandle>;
}

const DEFAULTS: WaveParams = {
  amp: 0.22,
  freq: 0.7,
  complexity: 0.5,
  speed: 0.5,
  thickness: 0.10,
  hue: 0.2,
  curve: 0.0,
  warp: 0.0,
  chroma: 0.85,
  bias: 0.0,
};

export function WaveShader({ className, initialParams, dark, ref }: Props): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);

  const paramsRef = useRef<WaveParams>({ ...DEFAULTS, ...initialParams });
  const darkRef = useRef<boolean>(!!dark);
  useEffect(() => {
    darkRef.current = !!dark;
  }, [dark]);

  const { variant } = useShaderVariant();
  const variantRef = useRef(variant);
  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      setParams: (next) => {
        Object.assign(paramsRef.current, next);
      },
      getParams: () => ({ ...paramsRef.current }),
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new Renderer({
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",

      dpr: 0.75,
    });
    const gl = renderer.gl;

    const canvas = gl.canvas;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    const geometry = new Triangle(gl);
    const v0 = variantRef.current;
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms: {
        t: { value: 0 },
        r: { value: [1, 1] },
        u_amp: { value: paramsRef.current.amp },
        u_freq: { value: paramsRef.current.freq },
        u_complex: { value: paramsRef.current.complexity },
        u_speed: { value: paramsRef.current.speed },
        u_thick: { value: paramsRef.current.thickness },
        u_hue: { value: paramsRef.current.hue },
        u_curve: { value: paramsRef.current.curve },
        u_warp: { value: paramsRef.current.warp },
        u_chroma: { value: paramsRef.current.chroma },
        u_bias: { value: paramsRef.current.bias },
        u_dark: { value: darkRef.current ? 1 : 0 },

        u_c0: { value: [...v0.wave[0]] },
        u_c1: { value: [...v0.wave[1]] },
        u_c2: { value: [...v0.wave[2]] },
        u_c3: { value: [...v0.wave[3]] },
        u_c4: { value: [...v0.wave[4]] },
      },
    });
    uniformsRef.current = program.uniforms as Record<string, { value: unknown }>;
    const mesh = new Mesh(gl, { geometry, program });

    let resizePending = 0;
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      program.uniforms.r.value[0] = gl.canvas.width;
      program.uniforms.r.value[1] = gl.canvas.height;
    };
    const queueResize = () => {
      if (resizePending) return;
      resizePending = requestAnimationFrame(() => {
        resizePending = 0;
        resize();
      });
    };
    resize();

    const ro = new ResizeObserver(queueResize);
    ro.observe(host);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        const wasVisible = visible;
        visible = entries[0]?.isIntersecting ?? true;

        if (visible && !wasVisible) last = performance.now();
        if (visible && !raf && !reduceMotion) loop();
      },
      { threshold: 0 },
    );
    io.observe(host);

    let raf = 0;

    let tAccum = 0;
    let last = performance.now();
    const FRAME_MS = 1000 / 60;

    const MAX_DT_MS = 50;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = now - last;
      if (dt < FRAME_MS - 1) return;

      tAccum += Math.min(dt, MAX_DT_MS) * 0.001;
      last = now - (dt % FRAME_MS);

      const p = paramsRef.current;
      program.uniforms.t.value = tAccum;
      program.uniforms.u_amp.value = p.amp;
      program.uniforms.u_freq.value = p.freq;
      program.uniforms.u_complex.value = p.complexity;

      program.uniforms.u_speed.value = Math.min(Math.max(p.speed, 0), 1.5);
      program.uniforms.u_thick.value = p.thickness;
      program.uniforms.u_hue.value = p.hue;
      program.uniforms.u_curve.value = p.curve;
      program.uniforms.u_warp.value = p.warp;
      program.uniforms.u_chroma.value = p.chroma;
      program.uniforms.u_bias.value = p.bias;
      program.uniforms.u_dark.value = darkRef.current ? 1 : 0;

      renderer.render({ scene: mesh });
    };
    if (reduceMotion) {
      const p = paramsRef.current;
      program.uniforms.t.value = 0;
      program.uniforms.u_amp.value = p.amp;
      program.uniforms.u_freq.value = p.freq;
      program.uniforms.u_complex.value = p.complexity;
      program.uniforms.u_speed.value = Math.min(Math.max(p.speed, 0), 1.5);
      program.uniforms.u_thick.value = p.thickness;
      program.uniforms.u_hue.value = p.hue;
      program.uniforms.u_curve.value = p.curve;
      program.uniforms.u_warp.value = p.warp;
      program.uniforms.u_chroma.value = p.chroma;
      program.uniforms.u_bias.value = p.bias;
      program.uniforms.u_dark.value = darkRef.current ? 1 : 0;
      renderer.render({ scene: mesh });
    } else {
      loop();
    }

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && !raf && !reduceMotion) {

        last = performance.now();
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizePending);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.remove();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, []);

  useEffect(() => {
    const u = uniformsRef.current;
    if (!u) return;
    const w = variant.wave;
    (u.u_c0!.value as number[]).splice(0, 3, ...w[0]);
    (u.u_c1!.value as number[]).splice(0, 3, ...w[1]);
    (u.u_c2!.value as number[]).splice(0, 3, ...w[2]);
    (u.u_c3!.value as number[]).splice(0, 3, ...w[3]);
    (u.u_c4!.value as number[]).splice(0, 3, ...w[4]);
  }, [variant]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    />
  );
}
