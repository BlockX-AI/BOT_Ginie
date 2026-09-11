"use client";

import { usePathname } from "next/navigation";
import HeroHeader from "@/components/HeroHeader";

/**
 * Hides the global HeroHeader on specific routes (e.g. /chat).
 */
export default function HeroHeaderGate() {
  const pathname = usePathname() || "/";

  // Hide header on chat pages ("/chat" and "/chat/..." routes).
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null;
  }

  return <HeroHeader />;
}
