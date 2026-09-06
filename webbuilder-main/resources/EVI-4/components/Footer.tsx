import Link from 'next/link';
import { Code, Github, MessageCircle, Book, Heart } from 'lucide-react';

export default function Footer() {
  return (
  <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Code className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-xl gradient-text">
                Camp Codegen
              </span>
            </Link>
            <p className="text-gray-300 mb-4 max-w-md">
              Build IP-native Apps & Agents in Minutes. One-click generator powered by Camp Network 
              with Origin SDK integration and automated royalties.
            </p>
            <div className="flex items-center text-gray-400">
              <span>Built with</span>
              <Heart className="h-4 w-4 mx-1 text-red-400" />
              <span>on Camp Network</span>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-white mb-4">Resources</h3>
            <div className="space-y-2">
              <Link href="#" className="block text-gray-300 hover:text-white transition-colors">
                Documentation
              </Link>
              <Link href="#" className="block text-gray-300 hover:text-white transition-colors">
                Templates
              </Link>
              <Link href="#" className="block text-gray-300 hover:text-white transition-colors">
                Tutorials
              </Link>
              <Link href="#" className="block text-gray-300 hover:text-white transition-colors">
                API Reference
              </Link>
            </div>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold text-white mb-4">Community</h3>
            <div className="space-y-2">
              <Link href="#" className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </Link>
              <Link href="#" className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                <MessageCircle className="h-4 w-4" />
                <span>Discord</span>
              </Link>
              <Link href="#" className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                <MessageCircle className="h-4 w-4" />
                <span>Telegram</span>
              </Link>
              <Link href="#" className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                <Book className="h-4 w-4" />
                <span>Camp Network</span>
              </Link>
            </div>
          </div>
        </div>

  <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm mb-4 sm:mb-0">
            © 2025 Camp Codegen. All rights reserved.
          </div>
          <div className="flex space-x-6 text-sm">
            <Link href="#" className="text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}