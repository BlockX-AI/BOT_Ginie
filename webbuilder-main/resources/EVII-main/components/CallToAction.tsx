"use client";

import { Button } from './ui/button';
import Link from 'next/link';
import { ArrowRight, Github, MessageCircle } from 'lucide-react';

export default function CallToAction() {
  return (
  <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background/50">
      <div className="max-w-4xl mx-auto text-center">
  <div className="bg-secondary/50 rounded-3xl border border-primary/20 p-12 backdrop-blur-sm">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            Ready to Build the <span className="gradient-text">Future of IP</span>?
          </h2>

          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of creators and developers building the next generation of IP-native applications
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link href="/smart-contract">
              <Button variant="gradient" size="lg" className="text-lg px-8 py-4 h-auto">
                Try It Now - Generate Your First App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary/50">
              <MessageCircle className="mr-2 h-5 w-5" />
              Join the Community
            </Button>
          </div>

          <div className="flex justify-center items-center space-x-6 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Testnet Live</span>
            </div>
            <div className="flex items-center space-x-2">
              <Github className="h-4 w-4" />
              <span>Open Source</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Free to Use</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}