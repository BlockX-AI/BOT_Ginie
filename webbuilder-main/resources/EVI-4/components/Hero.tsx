"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import TypingText from './TypingText';
import NetworkAnimation from './NetworkAnimation';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Network Animation */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <NetworkAnimation />
      </div>

      {/* Warm gradient overlay */}
      <div className="absolute inset-0 pointer-events-none gradient-bg" />

      {/* Pulsing halo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[48rem] rounded-full blur-3xl opacity-20 bg-gradient-to-r from-primary/40 via-purple-500/30 to-cyan-500/30 animate-pulse" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-5 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(251,146,60,0.3) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-secondary/60 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-primary mr-2" />
            <span className="text-sm text-gray-700">Powered by Basecamp</span>
          </div>
        </div>

    <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 text-black">
          <TypingText
            lines={["Build IP-native Apps", "& Agents in Minutes"]}
            speed={28}
            pauseBetween={400}
            highlightWords={["IP-native", "Apps", "Agents"]}
            highlightClassName="bg-orange-600/90 text-white highlight-on-orange px-1 py-[0.1rem] rounded-sm leading-none"
          />
        </h1>

        <p className="text-xl sm:text-2xl text-gray-800 mb-4 max-w-3xl mx-auto leading-relaxed">
          Let AI generate and deploy smart contracts faster than making a Maggi.
        </p>

        {/* Animated stats */}
        <DeploymentsCounter />

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link href="/pipeline">
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary/50 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Deploy Smart Contract
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/deploy-token">
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary/50">
              Deploy Token
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/fix-deploy">
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary/50">
              Fix & Deploy
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Quick Explainer */}
        <div className="max-w-4xl mx-auto">
      <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/80 flex items-center justify-center">
                  <span className="text-2xl font-bold">1</span>
                </div>
                <h3 className="font-semibold mb-2">Describe</h3>
                <p className="text-gray-400 text-sm">"Remix app with 10% royalties"</p>
              </div>
              <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/80 flex items-center justify-center">
                  <span className="text-2xl font-bold">2</span>
                </div>
                <h3 className="font-semibold mb-2">Generate</h3>
                <p className="text-gray-400 text-sm">Contracts + UI + Origin integration</p>
              </div>
              <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/80 flex items-center justify-center">
                  <span className="text-2xl font-bold">3</span>
                </div>
                <h3 className="font-semibold mb-2">Deploy</h3>
                <p className="text-gray-400 text-sm">Basecamp ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DeploymentsCounter() {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const target = 25000; // 25,000+
    const duration = 1600; // ms
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const display = new Intl.NumberFormat('en-US').format(count);

  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-400/10 px-4 py-2">
        <span className="text-2xl sm:text-3xl font-bold text-orange-600 tabular-nums">{display}+</span>
        <span className="text-sm sm:text-base text-gray-700">smart contracts deployed in the last 7 days</span>
      </div>
    </div>
  );
}