"use client";

import { Shield, Zap, Link, DollarSign } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Origin SDK Integration',
    description: 'Built-in social proofs, provenance tracking, and licensing mechanisms for all your IP.',
  color: 'text-primary'
  },
  {
    icon: Zap,
    title: 'mAItrix-Ready',
    description: 'Deploy AI agents with automatic usage receipts and inference metering out of the box.',
  color: 'text-primary'
  },
  {
    icon: Link,
    title: 'Camp-Native Scaffolds',
    description: 'Solidity contracts, Next.js UI, and subgraphs pre-configured for seamless integration.',
  color: 'text-primary'
  },
  {
    icon: DollarSign,
    title: 'Gasless + Auto Royalties',
    description: 'Creator-first design with automatic royalty splits and gasless onboarding experiences.',
  color: 'text-primary'
  }
];

export default function Features() {
  return (
  <section id="features" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8 bg-background/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6 text-white">
            <span className="text-primary">Powerful Features</span> for Modern dApps
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Everything you need to build production-ready IP-native applications with seamless Camp Network integration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group relative bg-secondary/40 backdrop-blur-sm rounded-2xl border border-border p-8 hover:border-primary/30 transition-all duration-500 network-glow"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center group-hover:bg-secondary/70 transition-colors duration-300">
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading text-xl font-semibold mb-3 text-white group-hover:text-primary transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ring-1 ring-primary/20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}