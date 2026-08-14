"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

export interface StarBurstProps {
  /** Animation speed multiplier */
  speed?: number;
  /** Radial density of the stars */
  density?: number;
  /** Number of angular spokes/stars */
  starCount?: number;
  /** Star color (hex format) */
  color?: string;
  /** Horizontal focal point (0-1) */
  centerX?: number;
  /** Vertical focal point (0-1) */
  centerY?: number;
  /** Star glow size multiplier */
  starSize?: number;
  /** Overall brightness multiplier */
  brightness?: number;
  /** Overall opacity (0-1) */
  opacity?: number;
  /** Intensity of the center flower/bloom effect */
  flowerIntensity?: number;
  /** Speed of star twinkling animation */
  twinkleSpeed?: number;
  /** Amount of star wobble/movement */
  wobbleAmount?: number;
  /** Intensity of the inner star layer */
  innerLayerIntensity?: number;
  /** Intensity of the outer star layer */
  outerLayerIntensity?: number;
  /** Height of the vertical fade gradient */
  fadeHeight?: number;
  /** Additional CSS classes */
  className?: string;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uDensity;
  uniform float uStarCount;
  uniform vec3 uColor;
  uniform float uCenterX;
  uniform float uCenterY;
  uniform float uStarSize;
  uniform float uBrightness;
  uniform float uOpacity;
  uniform float uFlowerIntensity;
  uniform float uTwinkleSpeed;
  uniform float uWobbleAmount;
  uniform float uInnerLayerIntensity;
  uniform float uOuterLayerIntensity;
  uniform float uFadeHeight;

  varying vec2 vUv;

  const float PI = 3.14159265359;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float stars(vec2 uv, float radialOffset, float amount, float intensity) {
    float t = uTime * uSpeed;
    float rad = atan(uv.y, uv.x);
    float r = log(length(uv) + radialOffset) * amount - t;

    vec2 g = vec2(rad / PI * 0.5 + 0.5, r);
    g *= vec2(uStarCount, 1.0);

    vec2 s = vec2(1.0, 1.0);
    vec2 id = floor(g / s + 0.5);
    vec2 o = sign(g - s * id);

    float min_d = 100.0;
    for (int i = 0; i < 2; ++i) {
        for (int j = 0; j < 2; ++j) {
            vec2 nid = id + o * vec2(float(i), float(j));
            vec2 nh = hash22(nid) * 100.0;
            vec2 n = g - s * nid;

            float t2 = t * uTwinkleSpeed;
            vec2 np = vec2(cos(nh.x + t2), sin(nh.y + t2)) * uWobbleAmount;

            vec2 diff = n - np;
            diff.x *= (200.0 / uStarCount);

            float dt = dot(diff, diff);
            if (dt < min_d) {
                min_d = dt;
            }
        }
    }

    float d = sqrt(min_d);
    return (uStarSize * 0.05) / d * intensity;
  }

  float curve_mask(vec2 uv) {
    float x = uv.x;
    float y = 0.05 * x * x + 0.05;
    return smoothstep(-0.1, 0.1, abs(uv.y) - y);
  }

  float flower(vec2 uv) {
    float fade_out = smoothstep(1.5, 0.0, length(uv));
    float flower = smoothstep(1.2, 0.0, abs(sin(atan(uv.y * 4.0, uv.x) * 3.0)) * 0.7);
    return flower * fade_out * uFlowerIntensity;
  }

  void main() {
    vec2 uv = (vUv * uResolution - 0.5 * uResolution) / uResolution.y;
    vec2 centeredUv = vUv * 2.0 - 1.0;
    centeredUv.x *= uResolution.x / uResolution.y;

    vec2 centerOffset = vec2((uCenterX - 0.5) * 2.0, (uCenterY - 0.5) * 2.0);
    centerOffset.x *= uResolution.x / uResolution.y;

    vec2 pos = centeredUv - centerOffset;
    pos.y += 1.0;

    float s = stars(pos, 1.0, 20.0 * uDensity, uInnerLayerIntensity) * 0.5;
    float l = stars(pos, 5.0, 30.0 * uDensity, uOuterLayerIntensity) * 0.5;

    float f = flower(pos);
    float m = curve_mask(pos);

    float brightness = s + l + f;

    brightness *= m;

    float gradient = smoothstep(uFadeHeight, 0.0, abs(pos.y));
    brightness *= gradient;

    brightness *= uBrightness;

    float alpha = clamp(brightness, 0.0, 1.0) * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

const StarBurst: React.FC<StarBurstProps> = ({
  speed = 1,
  density = 0.5,
  starCount = 100,
  color = "#e3b3ea",
  centerX = 0.5,
  centerY = 0.5,
  starSize = 0.3,
  brightness = 1,
  opacity = 1,
  flowerIntensity = 0.5,
  twinkleSpeed = 0.2,
  wobbleAmount = 1,
  innerLayerIntensity = 1,
  outerLayerIntensity = 1.5,
  fadeHeight = 2.5,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uSpeed: { value: speed },
        uDensity: { value: density },
        uStarCount: { value: starCount },
        uColor: { value: new THREE.Color(color) },
        uCenterX: { value: centerX },
        uCenterY: { value: centerY },
        uStarSize: { value: starSize },
        uBrightness: { value: brightness },
        uOpacity: { value: opacity },
        uFlowerIntensity: { value: flowerIntensity },
        uTwinkleSpeed: { value: twinkleSpeed },
        uWobbleAmount: { value: wobbleAmount },
        uInnerLayerIntensity: { value: innerLayerIntensity },
        uOuterLayerIntensity: { value: outerLayerIntensity },
        uFadeHeight: { value: fadeHeight },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      material.uniforms.uTime.value = elapsedTime;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      renderer.setSize(newWidth, newHeight);
      material.uniforms.uResolution.value.set(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();

      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSpeed.value = speed;
      materialRef.current.uniforms.uDensity.value = density;
      materialRef.current.uniforms.uStarCount.value = starCount;
      materialRef.current.uniforms.uColor.value.set(color);
      materialRef.current.uniforms.uCenterX.value = centerX;
      materialRef.current.uniforms.uCenterY.value = centerY;
      materialRef.current.uniforms.uStarSize.value = starSize;
      materialRef.current.uniforms.uBrightness.value = brightness;
      materialRef.current.uniforms.uOpacity.value = opacity;
      materialRef.current.uniforms.uFlowerIntensity.value = flowerIntensity;
      materialRef.current.uniforms.uTwinkleSpeed.value = twinkleSpeed;
      materialRef.current.uniforms.uWobbleAmount.value = wobbleAmount;
      materialRef.current.uniforms.uInnerLayerIntensity.value =
        innerLayerIntensity;
      materialRef.current.uniforms.uOuterLayerIntensity.value =
        outerLayerIntensity;
      materialRef.current.uniforms.uFadeHeight.value = fadeHeight;
    }
  }, [
    speed,
    density,
    starCount,
    color,
    centerX,
    centerY,
    starSize,
    brightness,
    opacity,
    flowerIntensity,
    twinkleSpeed,
    wobbleAmount,
    innerLayerIntensity,
    outerLayerIntensity,
    fadeHeight,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden bg-transparent",
        className,
      )}
      style={{ minHeight: "inherit" }}
    />
  );
};

export default StarBurst;
