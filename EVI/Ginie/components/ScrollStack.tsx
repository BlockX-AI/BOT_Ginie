"use client";

import React, { ReactNode, useLayoutEffect, useRef, useCallback } from "react";
import Lenis from "lenis";

export interface ScrollStackItemProps {
  itemClassName?: string;
  children: ReactNode;
}

export const ScrollStackItem: React.FC<ScrollStackItemProps> = ({ children, itemClassName = "" }) => (
  <div
    className={`scroll-stack-card relative w-full h-80 mt-8 mb-0 p-12 rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.1)] box-border origin-top will-change-transform ${itemClassName}`.trim()}
    style={{
      backfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
    }}
  >
    {children}
  </div>
);

interface ScrollStackProps {
  className?: string;
  children: ReactNode;
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string;
  scaleEndPosition?: string;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
}

const ScrollStack: React.FC<ScrollStackProps> = ({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = true,
  onStackComplete,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stackCompletedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const cardsRef = useRef<HTMLElement[]>([]);
  const lastTransformsRef = useRef(new Map<number, any>());
  const isUpdatingRef = useRef(false);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const baseTopsRef = useRef<number[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0;
    if (scrollTop > end) return 1;
    return (scrollTop - start) / (end - start);
  }, []);

  const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
    if (typeof value === "string" && value.includes("%")) {
      return (parseFloat(value) / 100) * containerHeight;
    }
    return parseFloat(value as string);
  }, []);

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      return {
        scrollTop: window.scrollY,
        containerHeight: window.innerHeight,
        scrollContainer: document.documentElement,
      };
    } else {
      const scroller = scrollerRef.current;
      return {
        scrollTop: scroller ? scroller.scrollTop : 0,
        containerHeight: scroller ? scroller.clientHeight : 0,
        scrollContainer: scroller,
      };
    }
  }, [useWindowScroll]);

  const getElementOffset = useCallback(
    (element: HTMLElement) => {
      if (useWindowScroll) {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
      } else {
        return element.offsetTop;
      }
    },
    [useWindowScroll]
  );

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return;

    isUpdatingRef.current = true;

    const { scrollTop, containerHeight } = getScrollData();
    const stackPositionPx = parsePercentage(stackPosition, containerHeight);
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight);

    const endElement = useWindowScroll
      ? (document.querySelector(".scroll-stack-end") as HTMLElement | null)
      : (scrollerRef.current?.querySelector(".scroll-stack-end") as HTMLElement | null);

    const endElementTop = endElement ? getElementOffset(endElement) : 0;

    cardsRef.current.forEach((card, i) => {
      if (!card) return;

      // Use cached base offsets to avoid layout thrash while animating
      const cardTop = baseTopsRef.current[i] ?? getElementOffset(card);
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * i;
      const triggerEnd = cardTop - scaleEndPositionPx;
      const pinStart = cardTop - stackPositionPx - itemStackDistance * i;
      const pinEnd = endElementTop - containerHeight / 2;

      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;

      let blur = 0;
      if (blurAmount) {
        let topCardIndex = 0;
        for (let j = 0; j < cardsRef.current.length; j++) {
          const jCardTop = baseTopsRef.current[j] ?? getElementOffset(cardsRef.current[j]);
          const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j;
          if (scrollTop >= jTriggerStart) {
            topCardIndex = j;
          }
        }

        if (i < topCardIndex) {
          const depthInStack = topCardIndex - i;
          blur = Math.max(0, depthInStack * blurAmount);
        }
      }

      let translateY = 0;
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;

      if (isPinned) {
        translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i;
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i;
      }

      const newTransform = {
        // Use integer pixels to avoid subpixel text ghosting lines
        translateY: Math.round(translateY),
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      };

      const lastTransform = lastTransformsRef.current.get(i);
      const hasChanged =
        !lastTransform ||
        Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
        Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
        Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
        Math.abs(lastTransform.blur - newTransform.blur) > 0.1;

      if (hasChanged) {
  const transform = `translate3d(0, ${newTransform.translateY}px, 0.001px) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
  const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : "none";

        card.style.transform = transform;
        card.style.filter = filter;
        // Ensure later items sit above earlier items for proper stacking
        card.style.zIndex = String(1000 + i);

        lastTransformsRef.current.set(i, newTransform);
      }

      if (i === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackComplete?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });

    isUpdatingRef.current = false;
  }, [
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    calculateProgress,
    parsePercentage,
    getScrollData,
    getElementOffset,
  ]);

  const handleScroll = useCallback(() => {
    updateCardTransforms();
  }, [updateCardTransforms]);

  const setupLenis = useCallback(() => {
    if (useWindowScroll) {
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: true,
        syncTouchLerp: 0.075,
      });

      lenis.on("scroll", handleScroll as any);

      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);

      lenisRef.current = lenis;
      return lenis;
    } else {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const lenis = new Lenis({
        wrapper: scroller,
        content: scroller.querySelector(".scroll-stack-inner") as HTMLElement,
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        gestureOrientation: "vertical",
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: true,
        syncTouchLerp: 0.075,
      });

      lenis.on("scroll", handleScroll as any);

      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);

      lenisRef.current = lenis;
      return lenis;
    }
  }, [handleScroll, useWindowScroll]);

  useLayoutEffect(() => {
    if (!useWindowScroll && !scrollerRef.current) return;

    const cards = Array.from(
      useWindowScroll
        ? document.querySelectorAll(".scroll-stack-card")
        : (scrollerRef.current?.querySelectorAll(".scroll-stack-card") ?? [])
    ) as HTMLElement[];
    cardsRef.current = cards;
    const transformsCache = lastTransformsRef.current;

    cards.forEach((card, i) => {
      if (i < cards.length - 1) {
        card.style.marginBottom = `${itemDistance}px`;
      } else {
        // Remove any default bottom margin from the last card to avoid extra space
        card.style.marginBottom = `0px`;
      }
      card.style.willChange = "transform, filter";
      card.style.transformOrigin = "top center";
      card.style.backfaceVisibility = "hidden";
      card.style.transform = "translateZ(0)";
      (card.style as any).webkitTransform = "translateZ(0)";
      (card.style as any).perspective = "1000px";
      (card.style as any).webkitPerspective = "1000px";
      // Improve paint isolation to prevent blending artifacts
      (card.style as any).contain = "layout paint style";
      (card.style as any).isolation = "isolate";
      (card.style as any).WebkitFontSmoothing = "antialiased";
      (card.style as any).textRendering = "optimizeLegibility";
    });

    // Cache base offsets after margins are applied
    baseTopsRef.current = cards.map((card) => getElementOffset(card));

  setupLenis();

  // Fallback native scroll listeners in case Lenis is disabled or not active
  const nativeTarget: any = useWindowScroll ? window : scrollerRef.current;
  nativeTarget?.addEventListener("scroll", handleScroll as any, { passive: true });
  nativeTarget?.addEventListener("wheel", handleScroll as any, { passive: true });
  nativeTarget?.addEventListener("touchmove", handleScroll as any, { passive: true });

    // Dynamically extend the scroll distance so the stack stays pinned
    const setDynamicSpacer = () => {
      // For a tight end (stack right before footer), keep spacer at zero to avoid extra scroll area
      if (!cardsRef.current.length || !spacerRef.current) return;
      spacerRef.current.style.height = `0px`;
    };

    setDynamicSpacer();
    const onResize = () => {
      transformsCache.clear();
      // Re-cache base tops on resize
      baseTopsRef.current = cardsRef.current.map((card) => getElementOffset(card));
      setDynamicSpacer();
      updateCardTransforms();
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Recalculate after fonts load and on window load (prevents intermittent wrong offsets)
    try {
      (document as any).fonts?.ready?.then(() => {
        transformsCache.clear();
        baseTopsRef.current = cardsRef.current.map((card) => getElementOffset(card));
        setDynamicSpacer();
        updateCardTransforms();
      });
    } catch {}
    const onWindowLoad = () => {
      transformsCache.clear();
      baseTopsRef.current = cardsRef.current.map((card) => getElementOffset(card));
      setDynamicSpacer();
      updateCardTransforms();
    };
    window.addEventListener("load", onWindowLoad, { passive: true });

    // Observe size changes in cards to recalc without requiring a resize
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        transformsCache.clear();
        baseTopsRef.current = cardsRef.current.map((card) => getElementOffset(card));
        setDynamicSpacer();
        updateCardTransforms();
      });
      cards.forEach((el) => ro.observe(el));
      resizeObserverRef.current = ro;
    }

    updateCardTransforms();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (lenisRef.current) {
        lenisRef.current.destroy();
      }
      nativeTarget?.removeEventListener("scroll", handleScroll as any);
      nativeTarget?.removeEventListener("wheel", handleScroll as any);
      nativeTarget?.removeEventListener("touchmove", handleScroll as any);
      window.removeEventListener("resize", onResize as any);
      window.removeEventListener("load", onWindowLoad as any);
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch {}
        resizeObserverRef.current = null;
      }
      stackCompletedRef.current = false;
      cardsRef.current = [];
      transformsCache.clear();
      isUpdatingRef.current = false;
      baseTopsRef.current = [];
    };
  }, [
    itemDistance,
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    scaleDuration,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    setupLenis,
    updateCardTransforms,
  ]);

  const wrapperClasses = useWindowScroll
    ? `relative w-full h-auto overflow-y-visible overflow-x-visible ${className}`
    : `relative w-full h-full overflow-y-auto overflow-x-visible ${className}`;

  return (
    <div
      className={wrapperClasses.trim()}
      ref={scrollerRef}
      style={{
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        // Disable CSS smooth behavior; Lenis will handle easing to avoid double-smoothing
        scrollBehavior: "auto",
        WebkitTransform: "translateZ(0)",
        transform: "translateZ(0)",
        willChange: "scroll-position",
      }}
    >
      <div
        className="scroll-stack-inner pt-[20vh] px-6 md:px-12 lg:px-20 min-h-screen"
        style={{
          perspective: 1000,
          transformStyle: "preserve-3d",
          contain: "layout paint style",
        }}
      >
        {children}
        {/* Spacer dynamically sized to keep the stack pinned until complete */}
        <div className="scroll-stack-end w-full" ref={spacerRef} style={{ height: 0 }} />
      </div>
    </div>
  );
};

export default ScrollStack;
