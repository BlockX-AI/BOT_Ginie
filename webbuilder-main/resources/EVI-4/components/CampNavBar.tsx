"use client";

import { Code, Sparkles, Rocket, Users, Map, Layers3, HandCoins } from 'lucide-react';
import Link from 'next/link';
import { NavBar } from "@/components/ui/tubelight-navbar";
import Image from 'next/image';

export function CampNavBar() {
  const navItems = [
    { name: 'Home', url: '/#top', icon: Rocket },
    { name: 'Features', url: '#features', icon: Sparkles },
    { name: 'Templates', url: '#templates', icon: Layers3 },
    { name: 'Roadmap', url: '#roadmap', icon: Map },
    { name: 'Grants', url: '/grants', icon: HandCoins },
    { name: 'Developers', url: '/developers', icon: Code },
    { name: 'Community', url: '#ecosystem', icon: Users }
  ];

  return (
    <NavBar
      idleHide={false}
      items={navItems}
      brand={
        <Link href="/" className="flex items-center gap-2 pl-1 hover:opacity-90 transition-opacity">
          <div className="rounded-md overflow-hidden flex items-center justify-center" style={{ width: 26, height: 26 }}>
            <Image src="/icon.png" alt="CodeGen icon" width={26} height={26} className="h-[26px] w-[26px] object-cover" priority />
          </div>
          <span className="font-heading font-semibold text-sm">
            Camp Codegen
          </span>
        </Link>
      }
    />
  );
}