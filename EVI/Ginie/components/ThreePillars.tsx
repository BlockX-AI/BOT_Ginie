"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat"

gsap.registerPlugin(ScrollTrigger)

export default function JourneyPage() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const promptRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const heading = headingRef.current
    const prompt = promptRef.current
    if (!section || !heading || !prompt) return

    // initial states
    gsap.set(heading, { scale: 1.15, yPercent: -5, opacity: 1, transformOrigin: "50% 50%" })
    gsap.set(prompt, { y: 24, opacity: 0 })

      const tl = gsap.timeline({
      defaults: { ease: "power1.out" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        // Pin long enough so heading (shrunk) and prompt stay together
        end: "+=900",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    })

    // 1) Shrink and move heading up a bit
    tl.to(heading, { scale: 0.9, yPercent: -8, duration: 0.5 })
      // 2) Bring the prompt into view while pinned
      .to(prompt, { y: 0, opacity: 1, duration: 0.6 }, "+=0.05")
      // 3) Hold the scene briefly (consumes scroll while keeping both visible)
      .to({}, { duration: 0.4 })

    return () => {
      tl.kill()
      ScrollTrigger.getAll().forEach((st) => { if (st.trigger === section) st.kill() })
    }
  }, [])

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Single pinned section that contains BOTH the heading and the prompt box */}
      <section
        ref={sectionRef}
        className="relative min-h-screen overflow-hidden flex items-center justify-center"
      >
        {/* soft vignette + dotted background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06),transparent_60%)]" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl px-6 flex flex-col items-center gap-6 sm:gap-8">
          <h1
            ref={headingRef}
            className="mt-16 sm:mt-20 md:mt-24 lg:mt-28 font-playfair italic font-light text-[clamp(3rem,8vw,8rem)] leading-[0.95] text-white/95 text-center glow-heading [text-shadow:_0_0_20px_rgba(255,255,255,0.22)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Featured chat
          </h1>

          {/* Prompt lives inside the pinned section so it stays together */}
          <div ref={promptRef} className="w-full max-w-5xl pointer-events-auto">
            <AnimatedAIChat />
          </div>
        </div>
      </section>
    </main>
  )
}
