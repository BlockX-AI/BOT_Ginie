"use client";

import React from "react";
import ScrollStack, { ScrollStackItem } from "./ScrollStack";
import TrustedBy from "./TrustedBy";

type Feature = { title: string; body: string; gradient: string };

const features: Feature[] = [
  {
    title: "AI Contract Generation",
    body:
      "Describe your idea, and Ginie generates production‑ready Solidity code.",
    gradient: "linear-gradient(135deg,#8b5cf6 0%,#6366f1 60%,#4338ca 100%)",
  },
  {
    title: "Auto‑Deploy & Verify",
    body:
      "Deploy to live networks, verify on explorers, and get back one‑click links.",
    gradient: "linear-gradient(135deg,#22d3ee 0%,#3b82f6 60%,#1e3a8a 100%)",
  },
  {
    title: "AI Audit Engine",
    body:
      "Automated security analysis with categorized findings and fixes.",
    gradient: "linear-gradient(135deg,#34d399 0%,#10b981 60%,#065f46 100%)",
  },
  {
    title: "Compliance Orchestration",
    body:
      "Runs complete policy packs with NIST/ISO/GDPR mappings.",
    gradient: "linear-gradient(135deg,#a78bfa 0%,#f472b6 60%,#be185d 100%)",
  },
  {
    title: "Artifact Storage",
    body:
      "Sources, ABIs, and reports stored under one Job ID.",
    gradient: "linear-gradient(135deg,#60a5fa 0%,#2563eb 60%,#1e40af 100%)",
  },
  {
    title: "No‑Code Automation",
    body: "Everything runs through chat — web, CLI, or WhatsApp.",
    gradient: "linear-gradient(135deg,#f59e0b 0%,#ef4444 60%,#b91c1c 100%)",
  },
  {
    title: "Multi‑Chain Ready",
    body:
      "Compatible with Avalanche, Ethereum, Polygon, Base, and more.",
    gradient: "linear-gradient(135deg,#06b6d4 0%,#0ea5e9 60%,#0369a1 100%)",
  },
  {
    title: "Developer SDKs",
    body: "Integrate Ginie into your app with JS/Python SDKs.",
    gradient: "linear-gradient(135deg,#c084fc 0%,#8b5cf6 60%,#6d28d9 100%)",
  },
];

export default function Services() {
  return (
    <section className="relative bg-black pt-16 md:pt-24 pb-0">
      <div className="mx-auto w-full max-w-6xl px-6">
        {/* Section heading */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-playfair font-light  text-[clamp(1.6rem,3.6vw,2.6rem)] leading-tight text-white/95 [text-shadow:_0_0_28px_rgba(255,255,255,0.16)] glow-heading" style={{letterSpacing: "-0.01em"}}>
            What <em className="font-italic">are </em>the features
          </h2>
          <p className="mt-3 text-sm md:text-base text-white/60 font-body">
            We help you achieve more at every stage of code
          </p>
        </div>

        {/* Stacked scroll cards */}
        <div className="mt-12 md:mt-16">
          <ScrollStack
            useWindowScroll
            className="overflow-y-visible"
            // Tuned defaults for a tighter, more stable stack
            // @ts-ignore - props are accepted in the component signature
            itemDistance={90}
            itemStackDistance={28}
            baseScale={0.88}
            itemScale={0.035}
            stackPosition="22%"
            scaleEndPosition="12%"
          >
            {features.map((f, i) => (
              <ScrollStackItem
                key={i}
                itemClassName="font-body group bg-[#0b0b0b] ring-1 ring-white/10 hover:ring-white/20"
              >
                <div className="grid grid-cols-12 gap-6 items-center">
                  {/* Content */}
                  <div className="col-span-12 md:col-span-8">
                    <div className="text-white/60 text-sm mb-2">({String(i + 1).padStart(2, '0')})</div>
                    <h3 className="font-poppins font-semibold text-[clamp(1.6rem,3vw,2.25rem)] leading-tight text-white/90 transition-all duration-300 group-hover:text-white [text-shadow:_0_0_16px_rgba(255,255,255,0.08)] group-hover:[text-shadow:_0_0_20px_rgba(255,255,255,0.14)]">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-white/70 text-sm md:text-base max-w-prose transition-colors duration-300 group-hover:text-white/80">
                      {f.body}
                    </p>
                  </div>
                  {/* Visual */}
                  <div className="col-span-12 md:col-span-4">
                    <div
                      className="aspect-[16/9] w-full overflow-hidden rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.45)] transition-transform duration-300 will-change-transform ring-1 ring-white/5 group-hover:ring-white/15 group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-[0_50px_120px_rgba(0,0,0,0.6)]"
                      style={{ background: f.gradient }}
                    />
                  </div>
                </div>
              </ScrollStackItem>
            ))}
          </ScrollStack>
          {/* Trusted by carousel */}
          <TrustedBy />

          {/* Bottom gap after stack for breathing room before next section/footer */}
          <div className="h-12 md:h-16 lg:h-20" />
        </div>
      </div>
    </section>
  );
}
