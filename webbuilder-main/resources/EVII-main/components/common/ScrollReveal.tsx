"use client"

import React, { useEffect, useMemo, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

type ScrollRevealProps = {
  text: string
  className?: string
  // Animation tuning (all optional)
  distance?: number // translateY in px
  duration?: number // seconds per word
  rotate?: number // initial rotation in deg
  blur?: number // initial blur in px
  stagger?: number // seconds between words
  start?: string // ScrollTrigger start
  end?: string // ScrollTrigger end
  scrub?: boolean | number
}

export default function ScrollReveal({
  text,
  className,
  distance = 24,
  // Slower default duration for each word to create a more deliberate reveal
  duration = 1,
  rotate = 0,
  blur = 6,
  // Slightly larger default stagger for a gentler cascade
  stagger = 0.12,
  start = "top 85%",
  end = "bottom 70%",
  // Use a smoothing scrub by default so the animation follows scroll smoothly
  scrub = 1,
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null)

  // Split text into words while preserving spaces and punctuation grouping
  const tokens = useMemo(() => {
    // Match sequences of non-space or single spaces to preserve spacing
    return text.match(/\S+|\s+/g) || [text]
  }, [text])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const words = Array.from(container.querySelectorAll<HTMLSpanElement>("[data-word]"))

    // Set initial state
    gsap.set(words, {
      opacity: 0,
      y: distance,
      rotate,
      filter: `blur(${blur}px)`
    })

    const tween = gsap.to(words, {
      opacity: 1,
      y: 0,
      rotate: 0,
      filter: "blur(0px)",
      duration,
      // gentler ease for a smooth, non-bouncy feel
      ease: "power1.out",
      stagger,
      scrollTrigger: {
        trigger: container,
        start,
        end,
        scrub,
      },
    })

    return () => {
      tween?.kill()
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === container) st.kill()
      })
    }
  }, [distance, duration, rotate, blur, stagger, start, end, scrub])

  return (
    <span ref={containerRef} className={className}>
      {tokens.map((token, idx) => {
        const isSpace = /^\s+$/.test(token)
        if (isSpace) {
          return <span key={idx}>{token}</span>
        }
        return (
          <span
            key={idx}
            data-word
            className="inline-block will-change-transform"
            style={{ display: "inline-block" }}
          >
            {token}
          </span>
        )
      })}
    </span>
  )
}
