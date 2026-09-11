"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled to avoid wagmi hook issues during prerendering
const ChatPageContent = dynamic(() => import("./ChatPageContent"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen w-full relative bg-black flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/50" />
    </div>
  ),
});

export default function ChatPage() {
  return <ChatPageContent />;
}
