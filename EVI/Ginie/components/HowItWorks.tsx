"use client";

import { ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import Link from 'next/link';

const steps = [
  {
    number: '01',
    title: 'Describe Your Vision',
    description: 'Tell us what you want to build - "Remix app with 10% royalties" or "AI agent for dataset licensing"',
  example: '"Create a music remix platform with automatic royalty distribution"'
  },
  {
    number: '02',
    title: 'Generate Complete Stack',
    description: 'Get fully-configured contracts, UI components, and Origin SDK integrations in seconds',
  example: 'Smart contracts + React frontend + GraphQL subgraphs'
  },
  {
    number: '03',
    title: 'Deploy On-Chain',
    description: 'One-click deployment to your chosen network with automatic configuration and setup',
  example: 'Live on Avalanche Fuji with verified smart contracts'
  },
  {
    number: '04',
    title: 'Start Monetizing',
    description: 'Auto-royalties, creator splits, and inference revenue tracking work immediately',
  example: 'Earning from day one with transparent revenue sharing'
  }
];

export default function HowItWorks() {
  return (
  <section id="how-it-works" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            How <span className="gradient-text">It Works</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            From idea to deployed dApp in minutes, not months
          </p>
        </div>

        <div className="relative">
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-20 left-1/2 transform -translate-x-1/2 w-full h-px">
            <div className="absolute inset-0 flex items-center justify-between px-32">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="w-32 h-px bg-primary/30" />
                  <ArrowRight className="h-4 w-4 text-primary mx-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                <div className="font-poppins bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border p-6 hover:border-primary/30 transition-all duration-500 network-glow h-full">
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/80 text-primary-foreground font-bold text-xl mb-4 animate-pulse-glow`}>
                      {step.number}
                    </div>
                    <h3 className="font-heading text-xl font-semibold mb-3">
                      {step.title}
                    </h3>
                  </div>

                  <p className="text-gray-300 mb-4 leading-relaxed">
                    {step.description}
                  </p>

                  <div className="bg-secondary/40 rounded-lg p-3 border border-border">
                    <p className="text-sm text-primary italic">
                      {step.example}
                    </p>
                  </div>
                </div>

                {/* Mobile arrow */}
                <div className="lg:hidden flex justify-center my-4">
                  {index < steps.length - 1 && (
                    <ArrowRight className="h-6 w-6 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/smart-contract">
              <Button variant="gradient" size="lg" className="px-8 py-4 text-lg">
                Try It Now - Generate Your First App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}