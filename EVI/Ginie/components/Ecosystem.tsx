"use client";

import { Shield, Coins, Users, Zap } from 'lucide-react';

const benefits = [
  {
    icon: Shield,
    title: 'Provenance & Trust',
    description: 'Built-in IP provenance tracking ensures authenticity and builds trust with your users.',
    stat: '100%',
    statLabel: 'Verifiable'
  },
  {
    icon: Coins,
    title: 'Automated Royalties',
    description: 'Smart contract-based royalty distribution ensures creators get paid automatically.',
    stat: '0%',
    statLabel: 'Manual Work'
  },
  {
    icon: Users,
    title: 'Gasless Onboarding',
    description: 'Remove friction for your users with gasless transactions and seamless Web3 experiences.',
    stat: '10x',
    statLabel: 'Better UX'
  },
  {
    icon: Zap,
    title: 'Instant Deployment',
    description: 'Deploy to any supported chain with one click and start building immediately.',
    stat: '<1min',
    statLabel: 'Deploy Time'
  }
];

const partners = [
  { name: 'Avalanche', logo: '⛰️' },
  { name: 'Origin SDK', logo: '🔗' },
  { name: 'mAItrix', logo: '🤖' },
  { name: 'GraphQL', logo: '📊' }
];

export default function Ecosystem() {
  return (
  <section id="ecosystem" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6 text-white">
            Why Build on <span className="text-primary">Ginie?</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Join an ecosystem designed for creators, builders, and innovators in the IP-native economy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="group bg-secondary/40 backdrop-blur-sm rounded-2xl border border-border p-6 text-center hover:border-primary/30 transition-all duration-500 network-glow"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-all duration-300">
                <benefit.icon className="h-8 w-8 text-primary" />
              </div>

              <div className="mb-4">
                <div className="text-2xl font-bold text-primary mb-1">{benefit.stat}</div>
                <div className="text-sm text-gray-400">{benefit.statLabel}</div>
              </div>

              <h3 className="font-heading text-lg font-semibold mb-2">
                {benefit.title}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>



      </div>
    </section>
  );
}