"use client";

import { Calendar, CheckCircle, Clock, Zap } from 'lucide-react';

const roadmapItems = [
  {
    quarter: 'Q1 2025',
    title: 'OriginGraph MVP',
    description: 'Complete IP onboarding and licensing framework with Origin SDK integration',
    status: 'completed',
    features: ['Origin SDK integration', 'Basic IP licensing', 'Royalty distribution', 'Social proof system']
  },
  {
    quarter: 'Q2 2025',
    title: 'AgentFlow Launch',
    description: 'mAItrix integration with inference metering and AI agent monetization',
    status: 'current',
    features: ['mAItrix integration', 'Inference metering', 'Agent templates', 'Usage analytics']
  },
  {
    quarter: 'Q3 2025',
    title: 'Advanced Templates',
    description: 'Expanded template library with complex IP use cases and cross-chain support',
    status: 'upcoming',
    features: ['Cross-chain support', 'Advanced IP types', 'Template marketplace', 'Community templates']
  },
  {
    quarter: 'Q4 2025',
    title: 'Enterprise Features',
    description: 'White-label solutions, advanced analytics, and enterprise-grade tooling',
    status: 'upcoming',
    features: ['White-label solutions', 'Advanced analytics', 'Enterprise SDKs', 'Premium support']
  }
];

export default function Roadmap() {
  return (
  <section id="roadmap" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8 bg-background/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            <span className="gradient-text">Roadmap</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Our journey to make IP-native development accessible to everyone
          </p>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="hidden lg:block absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-primary/30" />

          <div className="space-y-12">
            {roadmapItems.map((item, index) => (
              <div key={index} className={`relative flex items-center ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                {/* Timeline dot */}
                <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full border-4 border-background bg-primary animate-pulse-glow" />

                {/* Content */}
                <div className={`w-full lg:w-1/2 ${index % 2 === 0 ? 'lg:pr-12' : 'lg:pl-12'}`}>
          <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border p-6 hover:border-primary/30 transition-all duration-500 network-glow">
                    <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-primary">{item.quarter}</span>
                      <div className="flex items-center space-x-2">
                        {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-400" />}
                        {item.status === 'current' && <Zap className="h-5 w-5 text-yellow-400" />}
                        {item.status === 'upcoming' && <Clock className="h-5 w-5 text-gray-400" />}
                        <span className={`text-xs font-medium ${
                          item.status === 'completed' ? 'text-green-400' : 
                          item.status === 'current' ? 'text-yellow-400' : 
                          'text-gray-400'
                        }`}>
                          {item.status === 'completed' ? 'Completed' : 
                           item.status === 'current' ? 'In Progress' : 
                           'Planned'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-heading text-xl font-semibold mb-3">
                      {item.title}
                    </h3>
                    <p className="text-gray-300 mb-4">
                      {item.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {item.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                          <span className="text-sm text-gray-400">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}