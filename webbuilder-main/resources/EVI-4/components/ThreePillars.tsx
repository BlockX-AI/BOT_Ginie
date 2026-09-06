"use client";

import { Palette, Bot, Layers3 } from 'lucide-react';
import { Button } from './ui/button';
import Link from 'next/link';

const pillars = [
  {
    icon: Palette,
    title: 'OriginGraph Templates',
    description: 'IP onboarding, licensing, and provenance tracking built into every template. Seamlessly handle royalties and creator attribution.',
  features: ['Social proof integration', 'Automated licensing', 'Creator royalties', 'IP provenance tracking']
  },
  {
    icon: Bot,
    title: 'AgentFlow Templates',
    description: 'mAItrix-ready AI agents with built-in inference metering, usage receipts, and monetization frameworks.',
  features: ['Inference metering', 'Usage receipts', 'Revenue tracking', 'Agent monetization']
  },
  {
    icon: Layers3,
    title: 'Full-stack Scaffolds',
    description: 'Complete development stack with Solidity contracts, Next.js frontend, and subgraphs configured for Camp Network.',
  features: ['Smart contracts', 'React frontends', 'GraphQL subgraphs', 'Camp SDK integration']
  }
];

export default function ThreePillars() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            Camp Codegen = <span className="gradient-text">3 Pillars</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Everything you need to build, deploy, and monetize IP-native applications and AI agents
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {pillars.map((pillar, index) => (
            <div
              key={index}
              className="group relative bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border p-8 hover:border-primary/30 transition-all duration-500 network-glow"
            >
              <div className="mb-6">
                <div className={`w-16 h-16 rounded-2xl bg-primary/80 flex items-center justify-center mb-4 animate-pulse-glow`}>
                  <pillar.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-heading text-2xl font-bold mb-4">
                  {pillar.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {pillar.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-primary/70" />
                    <span className="text-sm text-gray-400">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="w-full">
                <div className="w-full text-center border border-border rounded-md py-2 text-sm text-gray-500 bg-transparent cursor-default select-none">
                  Explore Template
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}