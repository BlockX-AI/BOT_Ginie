"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const steps = ["Init", "Generate", "Compile", "Fix", "Deploy", "Complete"] as const;

export default function JobTimeline({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center justify-between gap-4">
      {steps.map((label, idx) => {
        const state = idx < currentStep ? "done" : idx === currentStep ? "active" : "todo";
        return (
          <li key={label} className="flex-1">
            <div className="flex items-center gap-2">
              {state === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {state === "active" && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
              {state === "todo" && <Circle className="h-4 w-4 text-gray-500" />}
              <span className="text-xs text-gray-300">{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
