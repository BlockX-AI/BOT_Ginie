"""
Premium Design Patterns Library
================================
Predefined UI patterns and layouts that AI tools use to generate stunning websites.
These are battle-tested patterns from thousands of production websites.
"""

from typing import Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum


class LayoutType(Enum):
    """Types of page layouts"""
    LANDING = "landing"
    DASHBOARD = "dashboard"
    PORTFOLIO = "portfolio"
    ECOMMERCE = "ecommerce"
    BLOG = "blog"
    SAAS = "saas"
    DOCUMENTATION = "documentation"
    MINIMAL = "minimal"


class SectionType(Enum):
    """Types of page sections"""
    HERO = "hero"
    FEATURES = "features"
    PRICING = "pricing"
    TESTIMONIALS = "testimonials"
    CTA = "cta"
    FAQ = "faq"
    TEAM = "team"
    STATS = "stats"
    GALLERY = "gallery"
    CONTACT = "contact"
    FOOTER = "footer"
    NAVBAR = "navbar"


@dataclass
class ColorPalette:
    """Color scheme definition"""
    name: str
    primary: str
    secondary: str
    accent: str
    background: str
    foreground: str
    muted: str
    border: str
    
    def to_tailwind_config(self) -> Dict[str, str]:
        return {
            "primary": self.primary,
            "secondary": self.secondary,
            "accent": self.accent,
            "background": self.background,
            "foreground": self.foreground,
            "muted": self.muted,
            "border": self.border,
        }


# ============================================================================
# CURATED COLOR PALETTES (Premium Feel)
# ============================================================================

COLOR_PALETTES: Dict[str, ColorPalette] = {
    "modern_dark": ColorPalette(
        name="Modern Dark",
        primary="#8B5CF6",      # Purple
        secondary="#EC4899",    # Pink
        accent="#06B6D4",       # Cyan
        background="#0F172A",   # Slate 900
        foreground="#F8FAFC",   # Slate 50
        muted="#334155",        # Slate 700
        border="#1E293B",       # Slate 800
    ),
    "clean_light": ColorPalette(
        name="Clean Light",
        primary="#3B82F6",      # Blue
        secondary="#10B981",    # Emerald
        accent="#F59E0B",       # Amber
        background="#FFFFFF",
        foreground="#1F2937",   # Gray 800
        muted="#F3F4F6",        # Gray 100
        border="#E5E7EB",       # Gray 200
    ),
    "gradient_sunset": ColorPalette(
        name="Gradient Sunset",
        primary="#F97316",      # Orange
        secondary="#EC4899",    # Pink
        accent="#8B5CF6",       # Purple
        background="#18181B",   # Zinc 900
        foreground="#FAFAFA",   # Zinc 50
        muted="#27272A",        # Zinc 800
        border="#3F3F46",       # Zinc 700
    ),
    "nature_green": ColorPalette(
        name="Nature Green",
        primary="#22C55E",      # Green
        secondary="#14B8A6",    # Teal
        accent="#84CC16",       # Lime
        background="#FAFDF7",
        foreground="#1A2E1A",
        muted="#ECFDF5",        # Emerald 50
        border="#D1FAE5",       # Emerald 100
    ),
    "corporate_blue": ColorPalette(
        name="Corporate Blue",
        primary="#2563EB",      # Blue 600
        secondary="#0EA5E9",    # Sky 500
        accent="#6366F1",       # Indigo 500
        background="#FFFFFF",
        foreground="#1E293B",   # Slate 800
        muted="#F1F5F9",        # Slate 100
        border="#CBD5E1",       # Slate 300
    ),
    "web3_neon": ColorPalette(
        name="Web3 Neon",
        primary="#A855F7",      # Purple 500
        secondary="#22D3EE",    # Cyan 400
        accent="#F472B6",       # Pink 400
        background="#030712",   # Gray 950
        foreground="#F9FAFB",   # Gray 50
        muted="#1F2937",        # Gray 800
        border="#374151",       # Gray 700
    ),
}


# ============================================================================
# SECTION TEMPLATES (Code snippets for each section type)
# ============================================================================

SECTION_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "hero_gradient": {
        "type": SectionType.HERO,
        "name": "Gradient Hero with CTA",
        "description": "Full-screen hero with gradient background, animated text, and call-to-action buttons",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>
      
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-purple-300 mb-6">
            <Sparkles className="w-4 h-4" />
            Welcome to the future
          </span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl font-bold text-white mb-6"
        >
          Build Something{' '}
          <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent">
            Amazing
          </span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto"
        >
          Create stunning applications with modern design patterns and cutting-edge technology.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-white hover:opacity-90 transition-all flex items-center justify-center gap-2">
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl font-semibold text-white hover:bg-white/20 transition-all">
            Learn More
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
'''
    },
    
    "hero_minimal": {
        "type": SectionType.HERO,
        "name": "Minimal Hero",
        "description": "Clean, minimal hero with simple typography and subtle animation",
        "dependencies": ["framer-motion"],
        "code": '''
import { motion } from 'framer-motion';

const MinimalHero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0, 1] }}
          className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Simple. Clean. Effective.
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto"
        >
          Minimal design that focuses on what matters most.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10"
        >
          <button className="px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full font-medium hover:scale-105 transition-transform">
            Get Started
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default MinimalHero;
'''
    },
    
    "features_bento": {
        "type": SectionType.FEATURES,
        "name": "Bento Grid Features",
        "description": "Modern bento-box style feature grid with varied card sizes",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { motion } from 'framer-motion';
import { Zap, Shield, Sparkles, Layers, Globe, Rocket } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Lightning Fast', description: 'Optimized for speed and performance', size: 'large' },
  { icon: Shield, title: 'Secure', description: 'Enterprise-grade security', size: 'small' },
  { icon: Sparkles, title: 'Modern', description: 'Latest technologies', size: 'small' },
  { icon: Layers, title: 'Scalable', description: 'Grows with your needs', size: 'medium' },
  { icon: Globe, title: 'Global', description: 'Worldwide availability', size: 'medium' },
  { icon: Rocket, title: 'Powerful', description: 'Advanced capabilities', size: 'small' },
];

const BentoFeatures = () => {
  return (
    <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Everything you need
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Packed with features to help you build faster and smarter.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`
                group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300
                ${feature.size === 'large' ? 'md:col-span-2 md:row-span-2' : ''}
                ${feature.size === 'medium' ? 'md:col-span-1 md:row-span-2' : ''}
              `}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BentoFeatures;
'''
    },
    
    "pricing_cards": {
        "type": SectionType.PRICING,
        "name": "Pricing Cards with Highlight",
        "description": "Three-tier pricing with highlighted recommended plan",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$9',
    period: '/month',
    description: 'Perfect for getting started',
    features: ['5 Projects', '10GB Storage', 'Basic Support', 'API Access'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'Best for professionals',
    features: ['Unlimited Projects', '100GB Storage', 'Priority Support', 'Advanced API', 'Custom Integrations', 'Analytics Dashboard'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For large teams',
    features: ['Everything in Pro', 'Unlimited Storage', '24/7 Support', 'Custom Solutions', 'SLA Guarantee', 'Dedicated Manager'],
    highlighted: false,
  },
];

const PricingSection = () => {
  return (
    <section className="py-24 px-4 bg-white dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">
            Choose the plan that works for you
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative p-8 rounded-3xl border-2 transition-all duration-300
                ${plan.highlighted 
                  ? 'border-purple-500 bg-gradient-to-b from-purple-500/10 to-transparent scale-105 shadow-xl shadow-purple-500/20' 
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50'}
              `}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-sm font-medium flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> Most Popular
                </div>
              )}
              
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">{plan.name}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">{plan.description}</p>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">{plan.price}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{plan.period}</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Check className="w-5 h-5 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button className={`
                w-full py-3 rounded-xl font-semibold transition-all
                ${plan.highlighted
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'}
              `}>
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
'''
    },
    
    "testimonials_carousel": {
        "type": SectionType.TESTIMONIALS,
        "name": "Testimonials Carousel",
        "description": "Animated testimonial cards with avatars and ratings",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'CEO at TechCorp',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
    content: 'This product has completely transformed how we work. The results have been incredible.',
    rating: 5,
  },
  {
    name: 'Michael Chen',
    role: 'Designer at Creative Co',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=michael',
    content: 'The best tool I have ever used. Clean, fast, and incredibly powerful.',
    rating: 5,
  },
  {
    name: 'Emily Davis',
    role: 'Founder at StartupXYZ',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emily',
    content: 'Exceeded all our expectations. Our team productivity increased by 200%.',
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Loved by thousands
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            See what our customers are saying
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              whileHover={{ y: -5 }}
              className="relative p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              <Quote className="absolute top-6 right-6 w-10 h-10 text-purple-500/20" />
              
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              
              <p className="text-slate-700 dark:text-slate-300 mb-6 text-lg">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full bg-slate-100"
                />
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{testimonial.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
'''
    },
    
    "cta_gradient": {
        "type": SectionType.CTA,
        "name": "Gradient CTA Banner",
        "description": "Eye-catching call-to-action with gradient background",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const CTASection = () => {
  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-12 md:p-16"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-white/80 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers and transform your workflow today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="group px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold hover:bg-white/90 transition-all flex items-center justify-center gap-2">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl font-semibold hover:bg-white/30 transition-all">
              Contact Sales
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default CTASection;
'''
    },
    
    "navbar_glass": {
        "type": SectionType.NAVBAR,
        "name": "Glassmorphism Navbar",
        "description": "Sticky navbar with glass effect and mobile menu",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": '''
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { name: 'Home', href: '#' },
  { name: 'Features', href: '#features' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'About', href: '#about' },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-700/50' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#" className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Brand
            </a>
            
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium"
                >
                  {link.name}
                </a>
              ))}
              <button className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
                Get Started
              </button>
            </div>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.nav>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-16 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="block text-slate-600 dark:text-slate-300 hover:text-purple-600 font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <button className="w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium">
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
'''
    },
    
    "footer_modern": {
        "type": SectionType.FOOTER,
        "name": "Modern Footer",
        "description": "Multi-column footer with social links and newsletter",
        "dependencies": ["lucide-react"],
        "code": '''
import { Github, Twitter, Linkedin, Instagram, Mail } from 'lucide-react';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Integrations', 'Changelog'],
  Company: ['About', 'Blog', 'Careers', 'Press'],
  Resources: ['Documentation', 'Help Center', 'Community', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security', 'Cookies'],
};

const socialLinks = [
  { icon: Twitter, href: '#' },
  { icon: Github, href: '#' },
  { icon: Linkedin, href: '#' },
  { icon: Instagram, href: '#' },
];

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-white pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <a href="#" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Brand
            </a>
            <p className="mt-4 text-slate-400 max-w-xs">
              Building the future of web applications with modern technology.
            </p>
            
            {/* Newsletter */}
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Subscribe to our newsletter</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
                <button className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
                  <Mail className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} Brand. All rights reserved.
          </p>
          
          <div className="flex gap-4">
            {socialLinks.map((social, index) => (
              <a
                key={index}
                href={social.href}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
'''
    },
    
    "stats_animated": {
        "type": SectionType.STATS,
        "name": "Animated Stats Counter",
        "description": "Counting animation stats section",
        "dependencies": ["framer-motion"],
        "code": '''
import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const stats = [
  { value: 10000, suffix: '+', label: 'Happy Customers' },
  { value: 99.9, suffix: '%', label: 'Uptime SLA' },
  { value: 50, suffix: 'M+', label: 'API Requests' },
  { value: 24, suffix: '/7', label: 'Support' },
];

const AnimatedCounter = ({ value, suffix }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const increment = value / (duration / 16);
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start * 10) / 10);
        }
      }, 16);
      
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
};

const StatsSection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-r from-purple-600 to-pink-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-white/80">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
'''
    },
}


# ============================================================================
# PAGE TEMPLATES (Complete page layouts)
# ============================================================================

PAGE_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "landing_page": {
        "type": LayoutType.LANDING,
        "name": "Modern Landing Page",
        "description": "Full landing page with hero, features, pricing, testimonials, and CTA",
        "sections": ["navbar_glass", "hero_gradient", "features_bento", "stats_animated", "pricing_cards", "testimonials_carousel", "cta_gradient", "footer_modern"],
        "color_palette": "modern_dark",
    },
    "portfolio": {
        "type": LayoutType.PORTFOLIO,
        "name": "Developer Portfolio",
        "description": "Portfolio site with projects showcase and contact form",
        "sections": ["navbar_glass", "hero_minimal", "features_bento", "testimonials_carousel", "cta_gradient", "footer_modern"],
        "color_palette": "gradient_sunset",
    },
    "saas_dashboard": {
        "type": LayoutType.SAAS,
        "name": "SaaS Product Page",
        "description": "SaaS product marketing page",
        "sections": ["navbar_glass", "hero_gradient", "features_bento", "pricing_cards", "testimonials_carousel", "cta_gradient", "footer_modern"],
        "color_palette": "corporate_blue",
    },
    "minimal_clean": {
        "type": LayoutType.MINIMAL,
        "name": "Minimal Clean",
        "description": "Simple, clean design with focus on content",
        "sections": ["navbar_glass", "hero_minimal", "features_bento", "cta_gradient", "footer_modern"],
        "color_palette": "clean_light",
    },
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_section_template(section_id: str) -> Dict[str, Any]:
    """Get a specific section template by ID"""
    return SECTION_TEMPLATES.get(section_id, {})


def get_page_template(template_id: str) -> Dict[str, Any]:
    """Get a complete page template by ID"""
    return PAGE_TEMPLATES.get(template_id, {})


def get_color_palette(palette_id: str) -> ColorPalette:
    """Get a color palette by ID"""
    return COLOR_PALETTES.get(palette_id, COLOR_PALETTES["modern_dark"])


def get_all_section_codes(page_template_id: str) -> List[str]:
    """Get all section codes for a page template"""
    template = get_page_template(page_template_id)
    if not template:
        return []
    
    codes = []
    for section_id in template.get("sections", []):
        section = get_section_template(section_id)
        if section:
            codes.append(section.get("code", ""))
    return codes


def get_required_dependencies(page_template_id: str) -> List[str]:
    """Get all required npm dependencies for a page template"""
    template = get_page_template(page_template_id)
    if not template:
        return []
    
    deps = set()
    for section_id in template.get("sections", []):
        section = get_section_template(section_id)
        if section:
            deps.update(section.get("dependencies", []))
    return list(deps)


def suggest_template_for_prompt(prompt: str) -> str:
    """Suggest best template based on user prompt keywords"""
    prompt_lower = prompt.lower()
    
    if any(kw in prompt_lower for kw in ['portfolio', 'personal', 'developer', 'designer']):
        return 'portfolio'
    elif any(kw in prompt_lower for kw in ['saas', 'product', 'app', 'software', 'subscription']):
        return 'saas_dashboard'
    elif any(kw in prompt_lower for kw in ['minimal', 'simple', 'clean', 'basic']):
        return 'minimal_clean'
    else:
        return 'landing_page'


# Export all for easy access
__all__ = [
    'LayoutType',
    'SectionType',
    'ColorPalette',
    'COLOR_PALETTES',
    'SECTION_TEMPLATES',
    'PAGE_TEMPLATES',
    'get_section_template',
    'get_page_template',
    'get_color_palette',
    'get_all_section_codes',
    'get_required_dependencies',
    'suggest_template_for_prompt',
]
