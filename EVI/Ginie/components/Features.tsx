"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const IMAGE_URL = "https://framerusercontent.com/images/Wne6ywIpp0BwY8GoBBoZlZEoC9g.png"

export default function Features() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const triptychRef = useRef<HTMLDivElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const triptych = triptychRef.current
    const heading = headingRef.current
    if (!section || !triptych || !heading) return

    // initial states
    gsap.set(heading, { y: 64, opacity: 0, filter: "blur(6px)", zIndex: 0 })
    gsap.set(triptych, { opacity: 1, scale: 1 })
    const panels = triptych.querySelectorAll<HTMLElement>(".panel")
    const inners = triptych.querySelectorAll<HTMLElement>(".card-inner")
    panels.forEach((p, i) => {
      // start as a single joined image (no gaps, edge rounding only)
      const radius = i === 0 ? "14px 0 0 14px" : i === 2 ? "0 14px 14px 0" : "0"
      gsap.set(p, { borderRadius: radius })
    })
    // 3D/card flip setup
    gsap.set(triptych, { transformPerspective: 1200 })
    gsap.set(inners, { rotateY: 0 })

    const tl = gsap.timeline({
      defaults: { ease: "power1.out" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=2200",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    })

    // 1) Keep image centered and scale down gently (the triptych starts merged so it looks like one image)
    tl.to(triptych, { scale: 0.9, duration: 0.6 })
      // 2) Heading rises from behind and settles above image
      .to(
        heading,
        { y: -28, opacity: 1, filter: "blur(0px)", duration: 0.7 },
        "<0.1"
      )
      // brief hold
      .to({}, { duration: 0.2 })
      // 3) Detach panels smoothly in-place (remove anti-alias seams, then increase gap and round corners)
      .to(
        triptych,
        { css: { gap: "1.5rem" }, duration: 0.5 },
        ">-0.05"
      )
      // clear the initial negative margins used to hide seams when merged
      .to(
        panels,
        { marginLeft: 0, marginRight: 0, duration: 0.2, stagger: 0.05 },
        "<"
      )
      .to(
        panels,
        { borderRadius: "16px", duration: 0.5, stagger: 0.05 },
        "<"
      )
      // 4) Flip each card to reveal feature content
      .to(
        inners,
        { rotateY: 180, duration: 0.8, ease: "power2.inOut", stagger: 0.12 },
        ">0.1"
      )
      // 5) Add slight tilt/offset for depth like the reference
      .to(panels[0], { rotation: -9, y: 12, duration: 0.6, ease: "power2.out" }, ">-0.3")
      .to(panels[1], { rotation: 0, y: 0, duration: 0.6, ease: "power2.out" }, "<")
      .to(panels[2], { rotation: 10, y: 12, duration: 0.6, ease: "power2.out" }, "<")

    return () => {
      tl.kill()
      ScrollTrigger.getAll().forEach((st) => st.kill())
    }
  }, [])

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-visible bg-black"
    >
      {/* dotted grid background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl px-6">

        {/* Heading overlays and animates from behind */}
        <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
          <h2
            ref={headingRef}
            className="mt-[6vh] font-playfair  font-light text-[clamp(1.2rem,3.2vw,2.4rem)] leading-[1.08] text-white/95 text-center [text-shadow:_0_0_28px_rgba(255,255,255,0.18)] glow-heading"
            style={{ letterSpacing: "-0.01em" }}
          >
            How <em className="italic opacity-90">it</em> works
          </h2>
        </div>

        {/* Triptych only: starts joined (gap-0) so it looks like a single image, then splits and flips in place */}
        <div
          ref={triptychRef}
          className="relative mx-auto grid grid-cols-3 gap-0 mt-[12vh] overflow-visible shadow-[0_40px_120px_rgba(0,0,0,0.55)] w-[92%] max-w-[1040px]"
          style={{ aspectRatio: "21/9", transformOrigin: "50% 50%", perspective: 1200 }}
        >
          {["left", "center", "right"].map((pos, idx) => (
            <div key={pos} className="panel relative will-change-transform">
              <div
                className="card-inner relative h-full w-full"
                style={{
                  transformStyle: "preserve-3d",
                  willChange: "transform",
                }}
              >
                {/* Front: slice of the original image for the "merged" state */}
                <div
                  className="card-face absolute inset-0"
                  style={{
                    backgroundImage: `url(${IMAGE_URL})`,
                    backgroundSize: "300% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition:
                      pos === "left"
                        ? "0% 50%"
                        : pos === "right"
                        ? "100% 50%"
                        : "50% 50%",
                    backfaceVisibility: "hidden",
                    borderRadius: idx === 0 ? "14px 0 0 14px" : idx === 2 ? "0 14px 14px 0" : "0",
                    // slight overlap to avoid subpixel seam when merged
                    marginLeft: pos !== "left" ? "-1px" : undefined,
                    marginRight: pos !== "right" ? "-1px" : undefined,
                  }}
                />
                {/* Back: feature content */}
                <div
                  className="card-face absolute inset-0 flex flex-col justify-between p-8 font-poppins"
                  style={{
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {/* themed background per card */}
                  <div
                    className="absolute inset-0 -z-10"
                    style={{
                      background:
                        pos === "center"
                          ? "radial-gradient(120% 120% at 50% 0%, #ff4d4d 0%, #7a0d0d 60%, #240606 100%)"
                          : pos === "left"
                          ? "linear-gradient(180deg, #f1f1f1 0%, #c9c9c9 60%, #8b8b8b 100%)"
                          : "linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 60%, #070707 100%)",
                      boxShadow:
                        pos === "center"
                          ? "0 30px 80px rgba(255,0,0,0.25)"
                          : "0 30px 80px rgba(0,0,0,0.45)",
                      borderRadius: "16px",
                    }}
                  />

                  {/* top micro icons placeholder */}
                  <div className="flex gap-2 text-white/70">
                    <span className="h-2 w-2 rounded-full border border-white/40" />
                    <span className="h-2 w-2 rounded-full border border-white/40" />
                  </div>

                  <div>
                    <h3 className="font-poppins text-white text-[clamp(1.4rem,3vw,2.4rem)] leading-tight font-semibold">
                      {pos === "left" && (
                        <>
                          Describe
                          <br />
                           your intent
                        </>
                      )}
                      {pos === "center" && (
                        <>
                          Ginie.
                          <br />
                          generates Solidity code
                        </>
                      )}
                      {pos === "right" && (
                        <>
                          Ginie.
                          <br />
                          deploys it live
                        </>
                      )}
                    </h3>
                    <p className="mt-4 text-sm text-white/70 max-w-[38ch] font-poppins">
                      {pos === "left" &&
                        "Create a DAO for community voting"}
                      {pos === "center" &&
                        "AI writes, fixes, and optimizes smart contracts."}
                      {pos === "right" &&
                        "On networks like Avalanche, Ethereum, or Base."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          ))}
        </div>
      </div>
    </section>
  )
}