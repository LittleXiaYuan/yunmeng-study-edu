"use client";

import React, {
  ElementType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ComponentPropsWithoutRef,
} from "react";
import {
  AnimationOptions,
  useAnimate,
  ValueAnimationTransition,
} from "motion/react";

import { cn } from "@/lib/utils";

const splitIntoCharacters = (text: string): string[] => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
};

const extractTextFromChildren = (
  children: React.ReactNode,
): string | undefined => {
  if (children == null) return "";

  if (typeof children === "string") return children;

  if (typeof children === "number") return String(children);

  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }

  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    const childText = element.props.children;

    if (childText != null) {
      return extractTextFromChildren(childText);
    }

    return "";
  }

  return "";
};

interface SegmentedWord {
  characters: string[];
  needsSpace: boolean;
}

export interface ThreeDLetterSwapProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> {
  /** Rotation axis for the flip animation */
  flipDirection?: "top" | "bottom";

  /** Styling for the back-facing character element */
  backFaceClassName?: string;

  /** React content to animate with the flip effect */
  children: React.ReactNode;

  /** Time in seconds between each character's animation start */
  staggerInterval?: number;

  /** Element type to render the wrapper as */
  as?: ElementType;

  /** Motion configuration for the animation behavior */
  animation?: ValueAnimationTransition | AnimationOptions;

  /** Styling for the front-facing character element */
  frontFaceClassName?: string;

  /** Starting point for the stagger sequence */
  staggerOrigin?: "first" | "last" | "center" | number | "random";

  /** Styling for the wrapper container */
  className?: string;

  /** Trigger animation when element scrolls into view */
  playOnScroll?: boolean;

  /** IntersectionObserver threshold for scroll trigger */
  scrollThreshold?: number;

  /** Enable blur effect during animation */
  blur?: boolean;

  /** Amount of blur in pixels during transition */
  blurAmount?: number;

  /** Duration of the animation in seconds */
  duration?: number;

  /** Callback fired when animation starts */
  onAnimationStart?: () => void;

  /** Callback fired when animation completes */
  onAnimationComplete?: () => void;

  /** Honor user's prefers-reduced-motion setting */
  respectReducedMotion?: boolean;
}

interface SwapGlyphProps {
  char: string;
  frontFaceClassName?: string;
  backFaceClassName?: string;
  flipDirection: "top" | "bottom";
  blur: boolean;
}

const SwapGlyph: React.FC<SwapGlyphProps> = ({
  char,
  frontFaceClassName,
  backFaceClassName,
  flipDirection,
  blur,
}) => {
  const secondFaceTransform =
    flipDirection === "top"
      ? "rotateX(-90deg) translateZ(0.5lh)"
      : "rotateX(90deg) translateZ(0.5lh)";

  return (
    <span
      className="letter-3d-swap-char-box-item inline-block relative"
      style={{
        transformStyle: "preserve-3d",
        transform: "translateZ(-0.5lh)",
        transformOrigin: "center center",
        willChange: "transform",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <span
        className={cn(
          "letter-3d-swap-front-face relative h-lh inline-block",
          frontFaceClassName,
        )}
        style={{
          transform: "translateZ(0.5lh)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          color: "inherit",
          filter: blur ? "blur(0px)" : undefined,
          opacity: blur ? 1 : undefined,
        }}
      >
        {char}
      </span>

      <span
        className={cn(
          "letter-3d-swap-back-face absolute h-lh top-0 left-0 inline-block",
          backFaceClassName,
        )}
        style={{
          transform: secondFaceTransform,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          color: "inherit",
          filter: blur ? "blur(0px)" : undefined,
          opacity: blur ? 0 : undefined,
        }}
      >
        {char}
      </span>
    </span>
  );
};

const ThreeDLetterSwap: React.FC<ThreeDLetterSwapProps> = ({
  children,
  as: Component = "p",
  className,
  frontFaceClassName,
  backFaceClassName,
  staggerInterval = 0.05,
  staggerOrigin = "first",
  animation = { type: "spring", damping: 30, stiffness: 300 },
  flipDirection = "top",
  playOnScroll = false,
  scrollThreshold = 0.1,
  blur = false,
  blurAmount = 4,
  duration,
  onAnimationStart,
  onAnimationComplete,
  respectReducedMotion = true,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hasPlayedOnScroll, setHasPlayedOnScroll] = useState(false);
  const [scope, animate] = useAnimate();
  const containerRef = useRef<HTMLElement>(null);
  const scopeRef = scope as React.MutableRefObject<HTMLElement | null>;

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const shouldAnimate = !respectReducedMotion || !prefersReducedMotion;

  const rotationTransform =
    flipDirection === "top" ? "rotateX(90deg)" : "rotateX(-90deg)";

  const text = useMemo(() => {
    try {
      return extractTextFromChildren(children);
    } catch (error) {
      console.error(error);
      return "";
    }
  }, [children]);

  const words = useMemo<SegmentedWord[]>(() => {
    const t = text?.split(" ") ?? [];
    const result = t.map((word: string, i: number) => ({
      characters: splitIntoCharacters(word),
      needsSpace: i !== t.length - 1,
    }));
    return result;
  }, [text]);

  const getStaggerDelay = useCallback(
    (index: number, totalChars: number) => {
      const total = totalChars;
      if (staggerOrigin === "first") return index * staggerInterval;
      if (staggerOrigin === "last")
        return (total - 1 - index) * staggerInterval;
      if (staggerOrigin === "center") {
        const center = Math.floor(total / 2);
        return Math.abs(center - index) * staggerInterval;
      }
      if (staggerOrigin === "random") {
        const randomIndex = Math.floor(Math.random() * total);
        return Math.abs(randomIndex - index) * staggerInterval;
      }
      return Math.abs(staggerOrigin - index) * staggerInterval;
    },
    [staggerOrigin, staggerInterval],
  );

  const playAnimation = useCallback(async () => {
    if (isAnimating || !shouldAnimate) return;

    setIsAnimating(true);
    onAnimationStart?.();

    const totalChars = words.reduce(
      (sum: number, word: SegmentedWord) => sum + word.characters.length,
      0,
    );

    const delays = Array.from({ length: totalChars }, (_, i) => {
      return getStaggerDelay(i, totalChars);
    });

    const mainDuration =
      duration !== undefined
        ? duration
        : typeof animation === "object" && "duration" in animation
          ? (animation.duration as number)
          : 0.6;

    const blurOutDuration = 0.2;
    const blurInDuration = 0.1;
    const blurInDelay = Math.min(mainDuration * 0.1, 0.15);

    if (blur) {
      await Promise.all([
        animate(
          ".letter-3d-swap-char-box-item",
          { transform: rotationTransform },
          {
            ...(animation as AnimationOptions),
            delay: (i: number) => delays[i],
          },
        ),
        animate(
          ".letter-3d-swap-front-face",
          { filter: `blur(${blurAmount}px)`, opacity: 0 },
          {
            duration: blurOutDuration,
            ease: "easeOut",
            delay: (i: number) => delays[i],
          },
        ),
        animate(
          ".letter-3d-swap-back-face",
          { filter: "blur(0px)", opacity: 1 },
          {
            duration: blurInDuration,
            ease: "easeIn",
            delay: (i: number) => delays[i] + blurInDelay,
          },
        ),
      ]);
    } else {
      await animate(
        ".letter-3d-swap-char-box-item",
        { transform: rotationTransform },
        {
          ...(animation as AnimationOptions),
          delay: (i: number) => delays[i],
        },
      );
    }

    await animate(
      ".letter-3d-swap-char-box-item",
      {
        transform: flipDirection === "top" ? "rotateX(0deg)" : "rotateX(0deg)",
      },
      { duration: 0 },
    );

    if (blur) {
      await Promise.all([
        animate(
          ".letter-3d-swap-front-face",
          { filter: "blur(0px)", opacity: 1 },
          { duration: 0 },
        ),
        animate(
          ".letter-3d-swap-back-face",
          { filter: "blur(0px)", opacity: 0 },
          { duration: 0 },
        ),
      ]);
    }

    setIsAnimating(false);
    onAnimationComplete?.();
  }, [
    isAnimating,
    shouldAnimate,
    words,
    animation,
    getStaggerDelay,
    rotationTransform,
    onAnimationStart,
    onAnimationComplete,
    blur,
    blurAmount,
    flipDirection,
    duration,
    animate,
  ]);

  const handleHoverStart = useCallback(async () => {
    if (isHovering || playOnScroll) return;
    setIsHovering(true);
    await playAnimation();
  }, [isHovering, playOnScroll, playAnimation]);

  const handleHoverEnd = useCallback(() => {
    setIsHovering(false);
  }, []);

  useEffect(() => {
    if (!playOnScroll || hasPlayedOnScroll || !shouldAnimate) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPlayedOnScroll) {
            setHasPlayedOnScroll(true);
            playAnimation();
          }
        });
      },
      { threshold: scrollThreshold },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [
    playOnScroll,
    hasPlayedOnScroll,
    scrollThreshold,
    playAnimation,
    shouldAnimate,
  ]);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      scopeRef.current = node;
      containerRef.current = node;
    },
    [scopeRef],
  );

  const containerStyles: React.CSSProperties = {
    perspective: "1000px",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  };

  const content = (
    <>
      <span className="sr-only">{text}</span>
      {words.map(
        (wordObj: SegmentedWord, wordIndex: number, array: SegmentedWord[]) => {
          const previousCharsCount = array
            .slice(0, wordIndex)
            .reduce(
              (sum: number, word: SegmentedWord) =>
                sum + word.characters.length,
              0,
            );

          return (
            <span
              key={wordIndex}
              style={{
                display: "inline-block",
                transformStyle: "preserve-3d",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
              }}
            >
              {wordObj.characters.map((char: string, charIndex: number) => {
                const totalIndex = previousCharsCount + charIndex;

                return (
                  <SwapGlyph
                    key={totalIndex}
                    char={char}
                    frontFaceClassName={frontFaceClassName}
                    backFaceClassName={backFaceClassName}
                    flipDirection={flipDirection}
                    blur={blur}
                  />
                );
              })}
              {wordObj.needsSpace && (
                <span
                  style={{
                    display: "inline-block",
                    width: "1ch",
                    minWidth: "1ch",
                  }}
                >
                  {" "}
                </span>
              )}
            </span>
          );
        },
      )}
    </>
  );

  const containerClassName = cn("relative", className);

  if (
    Component === "p" ||
    Component === "div" ||
    Component === "span" ||
    Component === "h1" ||
    Component === "h2" ||
    Component === "h3" ||
    Component === "h4" ||
    Component === "h5" ||
    Component === "h6"
  ) {
    const Tag = Component;
    return (
      <Tag
        className={containerClassName}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        style={containerStyles}
        ref={
          setRefs as React.Ref<
            HTMLParagraphElement &
              HTMLDivElement &
              HTMLSpanElement &
              HTMLHeadingElement
          >
        }
      >
        {content}
      </Tag>
    );
  }

  return (
    <div
      className={containerClassName}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      style={containerStyles}
      ref={setRefs as React.Ref<HTMLDivElement>}
    >
      {content}
    </div>
  );
};

ThreeDLetterSwap.displayName = "ThreeDLetterSwap";

export default ThreeDLetterSwap;
