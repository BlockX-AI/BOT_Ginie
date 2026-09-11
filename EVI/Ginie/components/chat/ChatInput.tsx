"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, Paperclip } from "lucide-react";

interface ChatInputProps {
  input: string;
  wsConnected: boolean;
  isBuilding: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onAttach?: (files: FileList | null) => void;
}

export function ChatInput({
  input,
  wsConnected,
  isBuilding,
  onInputChange,
  onSubmit,
  onAttach,
}: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const triggerFile = () => {
    fileRef.current?.click();
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onAttach) return;
    onAttach(e.target.files);
    // reset so same file can be re-selected
    e.currentTarget.value = "";
  };
  return (
    <div className="border-t border-white/5 bg-black/40 backdrop-blur-md p-4">
      <form onSubmit={onSubmit}>
        <div
          className={`bg-white/5 rounded-lg p-3 transition-colors ${
            input && input.trim()
              ? 'border border-white'
              : 'border border-white/10 hover:border-white/20 focus-within:border-white'
          }`}
        >
          <div className="flex gap-3">
            <Input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border-0 bg-transparent text-white font-sans placeholder:text-white/40 focus-visible:ring-0"
              disabled={!wsConnected || isBuilding}
            />
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={handleFiles}
                  multiple
                />

                <button
                  type="button"
                  onClick={triggerFile}
                  className="p-2 hover:bg-white/10 rounded transition text-white/60 hover:text-white"
                  aria-label="Attach files"
                  title="Attach files"
                >
                  <Paperclip size={18} />
                </button>

                {/* Send button with glassmorphism */}
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!wsConnected || !input.trim() || isBuilding}
                  className={`ml-2 inline-flex items-center justify-center rounded-full w-10 h-10 transition-transform border shadow-sm ${
                    !wsConnected || !input.trim() || isBuilding
                      ? 'bg-white/6 text-white/30 border-white/10 cursor-not-allowed backdrop-blur-sm'
                      : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-white border-white/20 hover:scale-105 backdrop-blur-md'
                  }`}
                  style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.5)' }}
                >
                  <ArrowUp size={16} strokeWidth={2} />
                </button>
              </div>
          </div>
        </div>
      </form>
    </div>
  );
}
