"use client";

import { Code2, Github, Book, Terminal } from 'lucide-react';
import { Button } from './ui/button';

export default function Developers() {
  return (
  <section id="developers" className="anchor-offset py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold mb-6">
            For <span className="gradient-text">Developers</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Full documentation, CLI tools, and integration guides for seamless development
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-primary/80 flex items-center justify-center animate-pulse-glow">
                  <Book className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-semibold mb-2">Complete Documentation</h3>
                  <p className="text-gray-300">Comprehensive guides for Ginie SDK, Foundry setup, and smart contract configuration.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-primary/80 flex items-center justify-center animate-pulse-glow">
                  <Terminal className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-semibold mb-2">CLI Tools</h3>
                  <p className="text-gray-300">Command-line interface for generating, testing, and deploying your applications.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-primary/80 flex items-center justify-center animate-pulse-glow">
                  <Github className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-semibold mb-2">Open Source</h3>
                  <p className="text-gray-300">All templates and tools are open source with active community contributions.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button variant="gradient" size="lg">
                Read Docs
              </Button>
              <Button variant="outline" size="lg" className="border-purple-500/30 hover:border-purple-500/50">
                View on GitHub
              </Button>
            </div>
          </div>

          <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">Install CLI</span>
              <Code2 className="h-4 w-4 text-purple-400" />
            </div>

            <div className="bg-background/80 rounded-lg p-4 border border-border">
              <code className="text-green-400 text-sm">
                npm install -g @ginie/codegen-cli
              </code>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Generate App</span>
              </div>
              <div className="bg-background/80 rounded-lg p-4 border border-border">
                <code className="text-green-400 text-sm">
                  ginie generate --template=remix --royalties=10%
                </code>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Deploy to Testnet</span>
              </div>
              <div className="bg-background/80 rounded-lg p-4 border border-border">
                <code className="text-green-400 text-sm">
                  ginie deploy --network=avalanche-fuji
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}