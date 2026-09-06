"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type DeployFormValues = {
  prompt: string;
  network: string;
};

type Props = {
  onSubmit: (values: DeployFormValues) => void;
  isSubmitting?: boolean;
};

export default function PromptForm({ onSubmit, isSubmitting }: Props) {
  const [prompt, setPrompt] = useState("");
  const [network, setNetwork] = useState("basecamp");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm mb-1">Prompt</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g., "ERC20 token with minting paused by default"'
          className="min-h-[140px]"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Network</label>
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Basecamp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basecamp">Basecamp</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="pt-2">
        <Button onClick={() => onSubmit({ prompt, network })} disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Deploy Now"}
        </Button>
      </div>
    </div>
  );
}
