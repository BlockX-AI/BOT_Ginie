"use client";

import React from "react";
import Image from "next/image";

type Logo = { name: string; src: string; width?: number; height?: number };

const defaultLogos: Logo[] = [
  { name: "Ethereum", src: "https://www.bunzz.dev/networks/ethereum.svg", width: 160, height: 48 },
  { name: "Polygon", src: "https://www.bunzz.dev/networks/polygon.svg", width: 160, height: 48 },
  { name: "Avalanche", src: "https://www.bunzz.dev/networks/avalanche.svg", width: 160, height: 48 },
  { name: "BNB Chain", src: "https://www.bunzz.dev/networks/bsc.svg", width: 160, height: 48 },
  { name: "Fantom", src: "https://www.bunzz.dev/networks/fantom.svg", width: 160, height: 48 },
  { name: "Arbitrum", src: "https://www.bunzz.dev/networks/arbitrum.svg", width: 160, height: 48 },
  { name: "Evmos", src: "https://www.bunzz.dev/networks/evmos.svg", width: 160, height: 48 },
  { name: "Chainlink", src: "https://www.bunzz.dev/networks/chainlink.svg", width: 160, height: 48 },
  { name: "Astar", src: "https://www.bunzz.dev/networks/astar.svg", width: 160, height: 48 },
  { name: "HECO", src: "https://www.bunzz.dev/networks/heco.svg", width: 160, height: 48 },
  { name: "Moonbeam", src: "https://www.bunzz.dev/networks/moonbeam.svg", width: 160, height: 48 },
  { name: "Moonriver", src: "https://www.bunzz.dev/networks/moonriver.svg", width: 160, height: 48 },
  { name: "Shiden", src: "https://www.bunzz.dev/networks/shiden.svg", width: 160, height: 48 },
];

export default function TrustedBy({ logos = defaultLogos }: { logos?: Logo[] }) {
  return (
  <div className="mt-40 md:mt-52 lg:mt-64 xl:mt-72 pt-8 md:pt-12 lg:pt-16">
  <div className="text-center mb-10 md:mb-14">
       <h2 className="font-playfair font-light  text-[clamp(1.6rem,3.6vw,2.6rem)] leading-tight text-white/95 [text-shadow:_0_0_28px_rgba(255,255,255,0.16)] glow-heading" style={{letterSpacing: "-0.01em"}}>
           Deploy on any <em className="font-italic">EVM</em> compatible chain
          </h2>
       
      
      </div>

      {/* Marquee */}
      <div
        className="group relative overflow-hidden py-6 mt-8 md:mt-12"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <style>{`
          @keyframes brand-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .marquee-run { animation: brand-marquee 28s linear infinite; }
          .group:hover .marquee-run { animation-play-state: paused; }
        `}</style>

        <div className="flex w-auto marquee-run items-center" aria-hidden>
          {[0, 1].map((dup) => (
            <ul
              key={dup}
              className="shrink-0 flex items-center gap-14 md:gap-20 px-6"
            >
              {logos.map((logo) => (
                <li key={`${dup}-${logo.name}`} className="shrink-0">
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={logo.width || 100}
                    height={logo.height || 32}
                    className="h-10 sm:h-12 md:h-14 w-auto opacity-80 grayscale contrast-125 hover:opacity-100 hover:grayscale-0 transition-all duration-200"
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
