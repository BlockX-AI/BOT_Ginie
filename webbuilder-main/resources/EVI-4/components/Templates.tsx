"use client";

import { Music, Database, Activity, Plus } from 'lucide-react';
import { Button } from './ui/button';

const templates = [
  {
    icon: Music,
    title: 'Remix Storefront',
    description: 'Music remix platform with automatic royalty splits and remix graph visualization.',
  features: ['Auto-splits', 'Remix tracking', 'Creator royalties', 'Social proof'],
  image: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    icon: Database,
    title: 'Dataset License Hub',
    description: 'Monetize your datasets with training licenses and inference revenue tracking.',
  features: ['Training licenses', 'Usage metering', 'Revenue tracking', 'API access'],
  image: 'https://images.pexels.com/photos/669996/pexels-photo-669996.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    icon: Activity,
    title: 'Proof-of-Use Oracle',
    description: 'Track off-chain usage and verify proof-of-use for IP licensing and royalties.',
  features: ['Usage tracking', 'Proof verification', 'Oracle integration', 'Automated payouts'],
  image: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=600'
  }
];

export default function Templates() {
  return (
  <section id="templates" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8 bg-background/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            <span className="gradient-text">Template Showcase</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Production-ready templates for the most common IP-native use cases
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {templates.map((template, index) => (
            <div 
              key={index}
              className="group relative bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all duration-500 network-glow"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={template.image} 
                  alt={template.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                <div className="absolute top-4 right-4">
                  <div className={`w-12 h-12 rounded-xl bg-primary/80 flex items-center justify-center animate-pulse-glow`}>
                    <template.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-heading text-xl font-semibold mb-3">
                  {template.title}
                </h3>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  {template.description}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  {template.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                      <span className="text-xs text-gray-400">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full border-primary/30 hover:border-primary/50 hover:bg-primary/10">
                  Try on Testnet
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-secondary/60 border border-border mb-4">
            <Plus className="h-5 w-5 text-primary mr-2" />
            <span className="text-gray-300">More templates added weekly</span>
          </div>
          <div>
            <Button variant="gradient" size="lg">
              Request Custom Template
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}