"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, FileCode } from "lucide-react";
import type { UserData } from "@/lib/utils";

interface ChatIdHeaderProps {
  userData: UserData | null;
  onBack: () => void;
}

export function ChatIdHeader({ userData, onBack }: ChatIdHeaderProps) {
  const email = userData?.email || "";
  const displayName = email ? email.split("@")[0] : "";
  const initials = ((): string => {
    const base = (displayName || email || "U").trim();
    if (!base) return "U";
    const parts = base.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "U";
    const second = parts[1]?.[0] ?? (parts[0]?.[1] ?? "");
    return (first + second).toUpperCase();
  })();
  return (
    <div className="border-b border-white/5 backdrop-blur-md px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-[220px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white/60 hover:text-white hover:bg-white/5"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </Button>
          <button
            type="button"
            aria-label="Open files"
            title="Open files"
            onClick={() => window.dispatchEvent(new CustomEvent('open-files-panel'))}
            className="text-white/60 hover:text-white hover:bg-white/5 rounded-md p-2"
          >
            <FileCode size={18} />
          </button>
          <div className="text-white font-serif italic text-2xl tracking-tight select-none">
            Ginnie.
          </div>
        </div>

      

        <div className="flex items-center justify-end gap-3 min-w-[220px]">
          {userData && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-sm text-white/70">{userData.email}</span>
              <span className="text-xs text-white/30">•</span>
              <span className="text-sm text-white font-medium">
                {userData.tokens_remaining} tokens
              </span>
            </div>
          )}

          <div
            className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white text-sm font-semibold"
            title={userData?.email || "Profile"}
          >
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
}
