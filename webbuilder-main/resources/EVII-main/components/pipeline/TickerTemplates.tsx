"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TickerItem = { label: string; text: string; category?: string; tags?: string[] };

export type TickerTemplatesProps = {
  items: TickerItem[];
  onSelect: (text: string) => void;
  autoSpeed?: number; // px/s
  direction?: "ltr" | "rtl";
  pauseOnHover?: boolean;
  resumeDelayMs?: number;
  snap?: "none" | "chip";
  inertia?: boolean;
  draggable?: boolean;
  className?: string;
};

// Utility for RAF loop
function useRafLoop(callback: (dt: number) => void, running: boolean) {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = (t: number) => {
      const last = lastRef.current || t;
      const dt = Math.min(64, t - last); // clamp
      lastRef.current = t;
      callback(dt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [callback, running]);
}

export function TickerTemplates({
  items,
  onSelect,
  autoSpeed = 30,
  direction = "ltr",
  pauseOnHover = true,
  resumeDelayMs = 3000,
  snap = "none",
  inertia = true,
  draggable = true,
  className,
}: TickerTemplatesProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef<HTMLDivElement | null>(null); // first sequence
  const railRef = useRef<HTMLDivElement | null>(null);

  const [seqW, setSeqW] = useState(0);
  const [isHover, setIsHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoScrolling, setAutoScrolling] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // transform offset in px (0..seqW)
  const offsetRef = useRef(0);
  const velocityRef = useRef(0); // px/s for inertia
  const startRef = useRef<{ x: number; t: number; id?: number } | null>(null);
  const lastMoveRef = useRef({ x: 0, t: 0 });
  const resumeTimerRef = useRef<number | null>(null);
  const justDraggedRef = useRef(false);

  const duplicated = useMemo(() => {
    // Duplicate items 3× for seamless wrap
    return [items, items, items];
  }, [items]);

  // Measure first sequence width
  useLayoutEffect(() => {
    const measure = () => {
      const el = seqRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      setSeqW(Math.max(1, Math.round(w)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (seqRef.current) ro.observe(seqRef.current);
    return () => ro.disconnect();
  }, [items.length]);

  // Prefers reduced motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const clampOffset = useCallback((val: number) => {
    if (seqW <= 0) return 0;
    // Keep within [0, seqW)
    let x = val % seqW;
    if (x < 0) x += seqW;
    return x;
  }, [seqW]);

  const applyTransform = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const x = offsetRef.current;
    // We render 3× sequences; translate by -x for leftward motion
    rail.style.transform = `translate3d(${-x}px, 0, 0)`;
  }, []);

  // Auto-scroll via RAF
  const autoStep = useCallback((dtMs: number) => {
    if (!autoScrolling || reducedMotion || isDragging || isHover) return;
    if (seqW <= 0) return;
    const dir = direction === "rtl" ? -1 : 1; // rtl means visually rightward
    const delta = (autoSpeed * (dtMs / 1000)) * dir;
    offsetRef.current = clampOffset(offsetRef.current + delta);
    applyTransform();
  }, [autoScrolling, reducedMotion, isDragging, isHover, seqW, direction, autoSpeed, clampOffset, applyTransform]);

  useRafLoop(autoStep, true);

  const pauseAuto = useCallback(() => {
    setAutoScrolling(false);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setAutoScrolling(true);
      resumeTimerRef.current = null;
    }, resumeDelayMs);
  }, [resumeDelayMs]);

  // Hover pause
  const onEnter = () => {
    if (!pauseOnHover) return;
    setIsHover(true);
    pauseAuto();
  };
  const onLeave = () => {
    setIsHover(false);
    scheduleResume();
  };

  // Utility to ignore drag start on interactive elements (let click pass through)
  const isInteractiveTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof Element)) return false;
    return !!el.closest('button, a, input, textarea, select, [role="button"]');
  };

  // Pointer drag with activation threshold
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggable) return;
    if (!viewportRef.current) return;
    // We allow drag to start even on interactive children; we'll suppress the click if a drag actually happened
    pauseAuto();
    startRef.current = { x: e.clientX, t: performance.now(), id: e.pointerId };
    lastMoveRef.current = { x: e.clientX, t: performance.now() };
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggable) return;
    // If not dragging yet, check threshold to activate drag
    if (!isDragging) {
      if (!startRef.current) return;
      const moved = Math.abs(e.clientX - startRef.current.x) > 4; // small threshold
      if (!moved) return;
      // Activate drag and capture further pointer events
      setIsDragging(true);
      viewportRef.current?.setPointerCapture?.(startRef.current.id ?? e.pointerId);
      lastMoveRef.current = { x: e.clientX, t: performance.now() };
    }
    const now = performance.now();
    const dx = e.clientX - lastMoveRef.current.x;
    // drag moves rail with the finger: moving right should decrease leftward offset
    offsetRef.current = clampOffset(offsetRef.current - dx);
    applyTransform();
    const dt = Math.max(1, now - lastMoveRef.current.t);
    velocityRef.current = (dx / dt) * 1000; // px/s
    lastMoveRef.current = { x: e.clientX, t: now };
  };

  const endDrag = useCallback(() => {
    if (!isDragging) {
      // No drag occurred; just schedule auto resume
      scheduleResume();
      startRef.current = null;
      return;
    }
    setIsDragging(false);
    if (inertia) {
      // Inertia with exponential decay
      const decay = 0.95; // per frame
      const minV = 5; // px/s
      const step = () => {
        const v = velocityRef.current * decay;
        velocityRef.current = v;
        if (Math.abs(v) < minV) {
          scheduleResume();
          return;
        }
        const dt = 16; // approx frame ms
        offsetRef.current = clampOffset(offsetRef.current - (v * (dt / 1000)));
        applyTransform();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      scheduleResume();
    }
    startRef.current = null;
    // Suppress the next click caused by releasing after a drag
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 100);
  }, [applyTransform, clampOffset, inertia, isDragging, scheduleResume]);

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = () => { if (!draggable) return; endDrag(); };
  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = () => { if (!draggable) return; endDrag(); };

  // Wheel support
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!draggable) return;
    pauseAuto();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0
      ? e.deltaX
      : (e.shiftKey ? e.deltaY : 0);
    if (delta !== 0) {
      offsetRef.current = clampOffset(offsetRef.current + delta);
      applyTransform();
    }
    scheduleResume();
  };

  // Keyboard support
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!draggable) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      pauseAuto();
      const delta = e.key === "ArrowLeft" ? -80 : 80;
      offsetRef.current = clampOffset(offsetRef.current + delta);
      applyTransform();
      scheduleResume();
      e.preventDefault();
    }
  };

  // Visibility pause
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setAutoScrolling(false);
      } else if (!isDragging && !isHover) {
        setAutoScrolling(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isDragging, isHover]);

  // Apply initial transform on mount
  useEffect(() => { applyTransform(); }, [applyTransform]);

  // Chip rendering
  const Chip: React.FC<{ item: TickerItem; index: number }> = ({ item }) => (
    <button
      type="button"
      className={cn(
        "px-3 py-1 rounded-full border bg-background hover:bg-muted transition-colors whitespace-nowrap shadow-sm text-sm",
        snap === "chip" && "snap-start"
      )}
      onClick={(e) => {
        if (justDraggedRef.current || isDragging) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onSelect(item.text);
      }}
      onFocus={() => pauseOnHover && pauseAuto()}
      onBlur={() => pauseOnHover && scheduleResume()}
    >
      {item.label}
    </button>
  );

  return (
    <div
      className={cn("w-full", className)}
      role="region"
      aria-label="Prompt names ticker"
    >
      <div
        ref={viewportRef}
        className={cn(
          "relative overflow-hidden",
          snap === "chip" && "snap-x snap-mandatory"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        tabIndex={0}
      >
        <div
          ref={railRef}
          className="flex gap-2 will-change-transform select-none"
          style={{
            // Ensure the rail is wide enough; content controls intrinsic width
            transform: "translate3d(0,0,0)",
          }}
        >
          {/* Three sequences to ensure seamless wrap in either direction */}
          <div ref={seqRef} className="flex gap-2">
            {items.map((it, i) => (
              <Chip key={`a-${i}-${it.label}`} item={it} index={i} />
            ))}
          </div>
          <div className="flex gap-2">
            {items.map((it, i) => (
              <Chip key={`b-${i}-${it.label}`} item={it} index={i} />
            ))}
          </div>
          <div className="flex gap-2">
            {items.map((it, i) => (
              <Chip key={`c-${i}-${it.label}`} item={it} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
