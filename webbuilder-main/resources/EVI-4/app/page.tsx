
import { CampNavBar } from '@/components/CampNavBar';
import Hero from '@/components/Hero';
import ThreePillars from '@/components/ThreePillars';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Templates from '@/components/Templates';
import Roadmap from '@/components/Roadmap';
import Ecosystem from '@/components/Ecosystem';
import CallToAction from '@/components/CallToAction';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import NetworkAnimation from '@/components/NetworkAnimation';

export default function Home() {
  return (
  <main id="top" className="relative min-h-screen bg-background pt-24 overflow-hidden">

      {/* Page-level background layers */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <NetworkAnimation />
      </div>
      <div className="absolute inset-0 pointer-events-none gradient-bg-strong" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[48rem] rounded-full blur-3xl opacity-20 bg-gradient-to-r from-primary/40 via-purple-500/30 to-cyan-500/30 animate-pulse" />
      </div>
      <div
        className="absolute inset-0 opacity-5 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(251,146,60,0.3) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <CampNavBar />
      <Hero />

      <ThreePillars />
      <Features />
      <HowItWorks />
      <Templates />
      <Roadmap />
      <Ecosystem />
      <CallToAction />
      <Footer />
    </main>
  );
}