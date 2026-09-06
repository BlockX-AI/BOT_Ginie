"use client";

import { cn } from "@/lib/utils";

type Props = {
  state: "queued" | "running" | "failed" | "completed";
  className?: string;
};

const styles: Record<Props["state"], string> = {
  queued: "bg-zinc-600/20 text-zinc-300 border border-zinc-600/40",
  running: "bg-blue-600/20 text-blue-300 border border-blue-600/40",
  failed: "bg-rose-600/20 text-rose-300 border border-rose-600/40",
  completed: "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40",
};

export default function StatusChip({ state, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[state],
        className
      )}
    >
      {state}
    </span>
  );
}
