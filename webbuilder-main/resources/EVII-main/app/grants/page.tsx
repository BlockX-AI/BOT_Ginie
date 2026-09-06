"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import NetworkAnimation from "@/components/NetworkAnimation";
import ApplicationFormModal from "@/components/grants/ApplicationFormModal";

export default function GrantsPage() {
  const [applyOpen, setApplyOpen] = useState(false);
  // Live Grant Ticker (light auto-update for excitement)
  const [funding, setFunding] = useState(250000);
  const [projectsFunded, setProjectsFunded] = useState(34);
  const [avgGrant, setAvgGrant] = useState(7300);
  useEffect(() => {
    const id = setInterval(() => {
      setFunding((f) => f + Math.floor(Math.random() * 200));
      if (Math.random() < 0.05) setProjectsFunded((p) => p + 1);
    }, 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative bg-white text-slate-800">
      {/* Background Layers */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <NetworkAnimation />
      </div>
      <div className="absolute inset-0 pointer-events-none gradient-bg" />
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

      {/* Navigation */}
      <nav className="relative z-10 py-6">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity" aria-label="Go to Home">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <Image src="/icon.png" alt="CodeGen icon" width={40} height={40} className="h-10 w-10 object-cover" priority />
              </div>
              <span className="text-2xl font-bold text-slate-800">CodeGen</span>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#grants" className="text-slate-600 hover:text-orange-600 transition-colors">Grants</a>
              <a href="#projects" className="text-slate-600 hover:text-orange-600 transition-colors">Projects</a>
              <a href="#resources" className="text-slate-600 hover:text-orange-600 transition-colors">Resources</a>
              <a href="#about" className="text-slate-600 hover:text-orange-600 transition-colors">About</a>
              <button
                onClick={() => setApplyOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full transition-all duration-200 hover:scale-105"
              >
                Apply Now
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-20 lg:py-32" id="grants">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center">
            {/* Announcement */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full warm-chip mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-orange-600">Applications Open - Funding Available</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              Your idea. <span className="warm-text-gradient animate-pulse">Our AI</span>. Funded.
            </h1>

            {/* Sub */}
            <p className="text-xl lg:text-2xl text-slate-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Turn your smart contract ideas into live projects. Deploy in minutes with CodeGen, then secure funding through the Grants Program.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={() => setApplyOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 hover:scale-105 warm-glow-lg"
              >
                Build & Apply
              </button>
              <Link
                href="#projects"
                className="border border-orange-500/30 text-orange-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 hover:bg-orange-500/10 hover:scale-105"
              >
                Explore Projects
              </Link>
            </div>

            {/* Live Grant Ticker */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Funding Pool Live
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="rounded-xl warm-surface p-4">
                  <div className="text-sm text-slate-600">Total Funding Available</div>
                  <div className="text-2xl font-semibold text-slate-900">${""}{funding.toLocaleString('en-US')}</div>
                </div>
                <div className="rounded-xl warm-surface p-4">
                  <div className="text-sm text-slate-600">Projects Funded</div>
                  <div className="text-2xl font-semibold text-slate-900">{projectsFunded}</div>
                </div>
                <div className="rounded-xl warm-surface p-4">
                  <div className="text-sm text-slate-600">Average Grant Size</div>
                  <div className="text-2xl font-semibold text-slate-900">${""}{avgGrant.toLocaleString('en-US')}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">$2.5M+</div>
                <div className="text-slate-600">Total Funding Distributed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">150+</div>
                <div className="text-slate-600">Projects Funded</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">85%</div>
                <div className="text-slate-600">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Grants? */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">Fuel your project with more than just funding.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl warm-surface p-6">
              <div className="text-2xl mb-2">💰</div>
              <div className="font-semibold mb-1">Funding</div>
              <p className="text-slate-600">Kickstart your idea with non-dilutive capital.</p>
            </div>
            <div className="rounded-2xl warm-surface p-6">
              <div className="text-2xl mb-2">🤝</div>
              <div className="font-semibold mb-1">Mentorship</div>
              <p className="text-slate-600">Guidance from seasoned builders and ecosystem partners.</p>
            </div>
            <div className="rounded-2xl warm-surface p-6">
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold mb-1">Tools</div>
              <p className="text-slate-600">End-to-end AI pipeline to ship faster than ever.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Grant Tiers */}
      <section className="py-20 bg-gradient-to-b from-orange-50/50 to-transparent">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">Grant Tiers</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              From early-stage ideas to established projects, we have funding options for every stage of your journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="rounded-2xl warm-surface p-8 transition-all duration-300 hover:scale-105 warm-glow">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl">🌱</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Starter Grants</h3>
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent mb-4">Up to $5K</div>
              <p className="text-slate-600 mb-6">Perfect for individual developers and small teams just getting started with smart contract ideas.</p>
              <ul className="space-y-2 text-slate-600 mb-8">
                {[
                  "CodeGen platform access",
                  "Community mentorship",
                  "Deployment support",
                  "Marketing assistance",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    {t}
                  </li>
                ))}
              </ul>
              <button onClick={() => setApplyOpen(true)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-xl font-semibold transition-all">
                Apply Now
              </button>
            </div>

            {/* Growth */}
            <div className="rounded-2xl warm-surface p-8 transition-all duration-300 hover:scale-105 warm-glow relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Growth Grants</h3>
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent mb-4">Up to $25K</div>
              <p className="text-slate-600 mb-6">For teams with validated concepts ready to scale and expand their smart contract ecosystem.</p>
              <ul className="space-y-2 text-slate-600 mb-8">
                {[
                  "Everything in Starter",
                  "1:1 technical mentorship",
                  "Security audit support",
                  "Investor introductions",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    {t}
                  </li>
                ))}
              </ul>
              <a href="#apply" className="w-full block text-center bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-xl font-semibold transition-all">
                Apply Now
              </a>
            </div>

            {/* Impact */}
            <div className="rounded-2xl border border-orange-500/30 bg-white/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md p-8 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_-25px_rgba(251,146,60,0.55)]">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl">⭐</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Impact Grants</h3>
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent mb-4">Up to $100K</div>
              <p className="text-slate-600 mb-6">For established teams building significant infrastructure or high-impact applications.</p>
              <ul className="space-y-2 text-slate-600 mb-8">
                {[
                  "Everything in Growth",
                  "Dedicated success manager",
                  "Custom partnership deals",
                  "Conference speaking slots",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    {t}
                  </li>
                ))}
              </ul>
              <a href="#apply" className="w-full block text-center bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-xl font-semibold transition-all">
                Apply Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Who Can Apply */}
      <section className="py-20" id="projects">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">Built for every kind of builder.</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Whether you’re solo or a growing team, CodeGen Grants can accelerate your path.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <div className="rounded-2xl warm-surface p-6 flex items-start gap-3">
              <div className="text-2xl">🛠</div>
              <div>
                <div className="font-semibold">Solo devs testing an idea.</div>
              </div>
            </div>
            <div className="rounded-2xl warm-surface p-6 flex items-start gap-3">
              <div className="text-2xl">🚀</div>
              <div>
                <div className="font-semibold">Small teams building MVPs.</div>
              </div>
            </div>
            <div className="rounded-2xl warm-surface p-6 flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <div className="font-semibold">First-time builders entering Web3.</div>
              </div>
            </div>
            <div className="rounded-2xl warm-surface p-6 flex items-start gap-3">
              <div className="text-2xl">🌍</div>
              <div>
                <div className="font-semibold">Founders scaling into funded startups.</div>
              </div>
            </div>
          </div>

          {/* Application Categories */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-8">Application Categories</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "🏛️", label: "DeFi Protocols" },
              { icon: "🎨", label: "NFT Projects" },
              { icon: "🎮", label: "GameFi" },
              { icon: "🏗️", label: "Infrastructure" },
              { icon: "🔧", label: "Developer Tools" },
              { icon: "🌐", label: "Social Platforms" },
              { icon: "📊", label: "Analytics" },
              { icon: "🔒", label: "Security Tools" },
            ].map((c, i) => (
              <div key={i} className="rounded-xl warm-chip p-6 text-center transition-all hover:scale-105">
                <span className="text-2xl mb-2 block">{c.icon}</span>
                <h4 className="font-semibold text-orange-600">{c.label}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Process */}
      <section className="py-20 bg-gradient-to-b from-orange-50/50 to-transparent" id="resources">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">From Prompt to Project — In One Flow</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Our streamlined process gets you from idea to funded project quickly and efficiently.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {[
              { icon: "⌨️", title: "Build with CodeGen", text: "Enter your idea → get a Solidity contract → deploy in minutes.", grad: "from-orange-500 to-amber-500" },
              { icon: "🔗", title: "Share Your Build", text: "Post on X/LinkedIn, tag us, and showcase what you’ve built.", grad: "from-orange-500 to-amber-500", strong: true },
              { icon: "📝", title: "Apply for a Grant", text: "Submit your deployed project, repo, and vision.", grad: "from-orange-600 to-amber-600", strong: true },
              { icon: "🪙", title: "Get Funded", text: "Unlock resources, mentorship, and community support to scale.", grad: "from-orange-600 to-amber-600" },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl warm-surface p-8 transition-all duration-300 hover:scale-105">
                <div className={`flex items-center gap-4 mb-6`}>
                  <div className={`w-16 h-16 bg-gradient-to-r ${c.grad} rounded-2xl flex items-center justify-center`}>
                    <span className={`text-2xl ${c.strong ? "text-white font-bold" : ""}`}>{c.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{c.title}</h3>
                    <p className="text-slate-600">{c.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-8">Application Timeline</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 max-w-4xl mx-auto">
              {[
                { n: 1, title: "Submit Application", sub: "Week 1" },
                { n: 2, title: "Review Process", sub: "Week 2-3" },
                { n: 3, title: "Decision & Funding", sub: "Week 4" },
              ].map((s, i) => (
                <div key={`wrap-${s.n}`} className="contents">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">{s.n}</div>
                    <div className="text-left">
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-slate-600 text-sm">{s.sub}</div>
                    </div>
                  </div>
                  {i < 2 && <div className="hidden md:block w-8 h-px bg-orange-300" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20" id="about">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">Success Stories</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">See how our grant recipients have transformed their ideas into thriving projects.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "DeFiSwap Protocol",
                grant: "$25K Growth Grant",
                pill: "from-blue-500 to-purple-500",
                quote:
                  "CodeGen grants helped us launch our AMM in just 3 weeks. The AI-generated contracts saved us months of development time.",
                stat: "$2M+ TVL",
                name: "Sarah Chen, Founder",
              },
              {
                title: "NFTMarketplace Pro",
                grant: "$15K Growth Grant",
                pill: "from-green-500 to-emerald-500",
                quote:
                  "The mentorship program connected us with industry experts who helped us scale from 0 to 10K users.",
                stat: "10K+ Users",
                name: "Mike Rodriguez, CTO",
              },
              {
                title: "GameFi Arena",
                grant: "$50K Impact Grant",
                pill: "from-purple-500 to-pink-500",
                quote:
                  "CodeGen's AI tools helped us prototype and launch our on-chain tournament system with security best practices baked in.",
                stat: "500K+ Matches",
                name: "Alex Kim, CEO",
              },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl warm-surface p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-r ${c.pill} rounded-full`} />
                  <div>
                    <h4 className="font-bold">{c.title}</h4>
                    <p className="text-slate-600 text-sm">{c.grant}</p>
                  </div>
                </div>
                <p className="text-slate-600 mb-4">“{c.quote}”</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-600 font-semibold">{c.stat}</span>
                  <span className="text-slate-500">{c.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16" id="apply">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="rounded-2xl warm-surface p-8 text-center warm-glow-lg">
            <h3 className="text-3xl font-bold mb-3">Ready to apply?</h3>
            <p className="text-slate-600 mb-6">Bring your idea, we’ll help you ship. Funding, mentorship, and tools included.</p>
            <button onClick={() => setApplyOpen(true)} className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 hover:scale-105">
              Start Application
            </button>
          </div>
        </div>
      </section>

      {/* Application Modal */}
      <ApplicationFormModal open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  );
}
