"use client"

import { useEffect, useMemo, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export default function ReferenceSection() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const line1 =
    "Ginie. is the world's first AI Blockchain Co-Pilot that lets you build, deploy, verify, audit, and ensure compliance all through a simple conversation."
  const line2 = "No code. No DevOps. No delays.".toUpperCase()

  const tokensLine1 = useMemo(() => line1.match(/\S+|\s+/g) || [line1], [line1])
  const tokensLine2 = useMemo(() => line2.match(/\S+|\s+/g) || [line2], [line2])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const words = Array.from(
      container.querySelectorAll<HTMLSpanElement>("[data-word]")
    )

    // Initial state: invisible, slightly below, blurred
    gsap.set(words, {
      opacity: 0,
      y: 28,
      filter: "blur(8px)",
    })

    // Build a timeline tied to scroll with pin, so the section stays while text reveals
    const tl = gsap.timeline({
      defaults: { ease: "power1.out" },
      scrollTrigger: {
        trigger: container,
        start: "top top",
        // length of the pinned scroll; increase for slower reveal
        end: "+=1400",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    })

    // Reveal all words across the pinned duration with a gentle stagger
    tl.to(words, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      stagger: 0.15,
      duration: 1, // relative; total timing is governed by scroll length
    })

    return () => {
      tl.kill()
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === container) st.kill()
      })
    }
  }, [])

  return (
    <section className="bg-black mt-32 sm:mt-40 md:mt-48 lg:mt-56 xl:mt-64">
      <div
        ref={containerRef}
        className="mx-auto max-w-6xl px-6 py-32 sm:py-40 md:py-48 lg:py-56 flex items-center justify-center min-h-[60vh]"
      >
  <h2 className="font-playfair text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal text-center leading-relaxed lg:leading-tight tracking-tight max-w-3xl mx-auto text-white/70">
          <span className="block [text-shadow:_0_10px_30px_rgba(255,255,255,0.06)]">
            {tokensLine1.map((token, i) => {
              if (/^\s+$/.test(token)) return <span key={`l1-s-${i}`}>{token}</span>
              return (
                <span
                  key={`l1-w-${i}`}
                  data-word
                  className="inline-block will-change-transform"
                  style={{ display: "inline-block" }}
                >
                  {token}
                </span>
              )
            })}
          </span>
          <span className="block mt-4 [text-shadow:_0_10px_30px_rgba(255,255,255,0.06)]">
            {tokensLine2.map((token, i) => {
              if (/^\s+$/.test(token)) return <span key={`l2-s-${i}`}>{token}</span>
              return (
                <span
                  key={`l2-w-${i}`}
                  data-word
                  className="inline-block will-change-transform"
                  style={{ display: "inline-block" }}
                >
                  {token}
                </span>
              )
            })}
          </span>
        </h2>
      </div>
    </section>
  )
}
