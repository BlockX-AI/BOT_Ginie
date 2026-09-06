"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Menu, X, Code, Network } from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
  <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Code className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-xl gradient-text">
              Camp Codegen
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="#templates" className="text-gray-300 hover:text-white transition-colors">
              Templates
            </Link>
            <Link href="#developers" className="text-gray-300 hover:text-white transition-colors">
              Developers
            </Link>
            <Link href="#roadmap" className="text-gray-300 hover:text-white transition-colors">
              Roadmap
            </Link>
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              Docs
            </Button>
            <Button variant="gradient" size="sm">
              Generate Now
            </Button>
          </div>

          <button
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-4">
              <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="#templates" className="text-gray-300 hover:text-white transition-colors">
                Templates
              </Link>
              <Link href="#developers" className="text-gray-300 hover:text-white transition-colors">
                Developers
              </Link>
              <Link href="#roadmap" className="text-gray-300 hover:text-white transition-colors">
                Roadmap
              </Link>
              <div className="flex flex-col space-y-2 pt-4">
                <Button variant="ghost" size="sm">
                  Docs
                </Button>
                <Button variant="gradient" size="sm">
                  Generate Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}