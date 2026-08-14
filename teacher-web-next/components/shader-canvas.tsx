"use client";

import { useShaderVariant } from "@/components/shader-variant-context";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import { useEffect, useRef, type ReactNode } from "react";

const VERT = `
attribute vec2 position;
varying vec2 v;
void main(){
  v = position;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 v;
uniform float t;
uniform vec2 r;
uniform vec2 c;
uniform float ci;

uniform vec3 u_pal_base;
uniform vec3 u_pal_warm;
uniform vec3 u_pal_mid;
uniform vec3 u_pal_cool;
uniform vec3 u_pal_cursor;
uniform vec3 u_pal_rgScale;
uniform float u_brightness;

float h(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float n(vec2 u){
  vec2 i = floor(u);
  vec2 f = fract(u);
  f = f*f*(3.0 - 2.0*f);
  float a = h(i);
  float b = h(i + vec2(1.0, 0.0));
  float c = h(i + vec2(0.0, 1.0));
  float d = h(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float m(vec2 u){
  return (n(u)*0.5 + n(u*2.0)*0.25) * 1.06667;
}

void main(){
  vec2 uv = (v * 0.5 + 0.5) * r / r.x;

  vec2 cn = c / r.x;
  vec2 toC = uv - cn;
  float dC = length(toC);
  float fall = exp(-dC * 9.0) * ci;

  vec2 sh = vec2(
    n(uv * 6.0 + vec2(t * 0.9,  0.0)),
    n(uv * 6.0 + vec2(0.0, t * 1.1))
  ) - 0.5;
  vec2 disp = sh * fall * 0.55;

  uv = uv * 5.0 + disp * 5.0;

  vec2 d1 = vec2( 0.18,  0.07) * t;
  vec2 d2 = vec2(-0.13,  0.21) * t;
  vec2 d3 = vec2( 0.09, -0.16) * t;

  float a = m(uv + d1);
  vec3 col = mix(u_pal_base, u_pal_warm, a * 2.5);

  float b = m(uv + a * 2.4 + d2);
  col = mix(col, u_pal_mid, b * 1.5);

  float dd = m(uv + b * 3.5 + d3);
  col = mix(col, u_pal_cool, dd);

  col += u_pal_cursor * fall;

  col *= u_pal_rgScale;
  gl_FragColor = vec4(col * u_brightness, 1.0);
}
`;

interface Props {
  className?: string;
}

const DPR_CAP = 1.5;

export function ShaderCanvas({ className }: Props): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const { variant } = useShaderVariant();

  const variantRef = useRef(variant);
  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

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
      dpr: 1,
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
        c: { value: [0, 0] },
        ci: { value: 0 },
        u_pal_base: { value: [...v0.hero.base] },
        u_pal_warm: { value: [...v0.hero.warm] },
        u_pal_mid: { value: [...v0.hero.mid] },
        u_pal_cool: { value: [...v0.hero.cool] },
        u_pal_cursor: { value: [...v0.hero.cursor] },
        u_pal_rgScale: { value: [...v0.hero.rgScale] },
        u_brightness: { value: v0.hero.brightness },
      },
    });
    uniformsRef.current = program.uniforms as Record<
      string,
      { value: unknown }
    >;
    const mesh = new Mesh(gl, { geometry, program });

    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      DPR_CAP,
    );
    renderer.dpr = dpr;

    let resizePending = 0;
    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      renderer.setSize(w, h);
      program.uniforms.r.value[0] = gl.canvas.width;
      program.uniforms.r.value[1] = gl.canvas.height;
      renderer.render({ scene: mesh });
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

    const target: [number, number] = [0, 0];
    const current: [number, number] = [0, 0];
    let targetCi = 0;
    let currentCi = 0;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        targetCi = 0;
        return;
      }
      const x = (e.clientX - rect.left) * (gl.canvas.width / rect.width);
      const yTop = (e.clientY - rect.top) * (gl.canvas.height / rect.height);
      target[0] = x;
      target[1] = gl.canvas.height - yTop;
      targetCi = 1;
    };
    const onLeave = () => {
      targetCi = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("blur", onLeave);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !raf && !reduceMotion) {
          last = performance.now();
          loop();
        }
      },
      { threshold: 0 },
    );
    io.observe(host);

    let raf = 0;
    const start = performance.now();
    let last = start;
    const FRAME_MS = 1000 / 60;

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
      last = now - (dt % FRAME_MS);

      const k = 1 - Math.pow(1 - 0.12, dt / FRAME_MS);
      current[0] += (target[0] - current[0]) * k;
      current[1] += (target[1] - current[1]) * k;

      const ki = 1 - Math.pow(1 - 0.06, dt / FRAME_MS);
      currentCi += (targetCi - currentCi) * ki;

      program.uniforms.t.value = (now - start) * 0.001;
      program.uniforms.c.value[0] = current[0];
      program.uniforms.c.value[1] = current[1];
      program.uniforms.ci.value = currentCi;
      renderer.render({ scene: mesh });
    };

    if (reduceMotion) {
      program.uniforms.t.value = 0;
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
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      canvas.remove();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, []);

  useEffect(() => {
    const u = uniformsRef.current;
    if (!u) return;
    const h = variant.hero;

    (u.u_pal_base!.value as number[]).splice(0, 3, ...h.base);
    (u.u_pal_warm!.value as number[]).splice(0, 3, ...h.warm);
    (u.u_pal_mid!.value as number[]).splice(0, 3, ...h.mid);
    (u.u_pal_cool!.value as number[]).splice(0, 3, ...h.cool);
    (u.u_pal_cursor!.value as number[]).splice(0, 3, ...h.cursor);
    (u.u_pal_rgScale!.value as number[]).splice(0, 3, ...h.rgScale);
    u.u_brightness!.value = h.brightness;
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
      }}
    />
  );
}
