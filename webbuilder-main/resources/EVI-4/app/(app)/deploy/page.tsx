"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PromptForm, { DeployFormValues } from "@/components/deploy/PromptForm";
import JobTimeline from "@/components/jobs/JobTimeline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function DeployPage() {
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (values: DeployFormValues) => {
    setSubmitting(true);
    setStarted(true);
    setStep(0);
    try {
      const res = await Api.runPipeline({
        prompt: values.prompt,
        network: values.network,
      });
      if (res?.ok && res.job?.id) {
        router.push(`/jobs/${res.job.id}`);
        return;
      }
      throw new Error("Unexpected response from server");
    } catch (err: any) {
      toast({ title: "Pipeline failed", description: err?.message || "Unknown error" });
      setStarted(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-heading text-3xl font-bold">New Deployment Wizard</h1>
      <Card className="p-6 bg-secondary/40 border-border">
        <PromptForm onSubmit={handleSubmit} isSubmitting={submitting} />
      </Card>

      {started && (
        <Card className="p-6 bg-secondary/40 border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Progress</h2>
            <Button variant="outline" size="sm">Cancel</Button>
          </div>
          <JobTimeline currentStep={step} />
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(step/5)*100}%` }} />
          </div>
          <div className="text-sm text-gray-400">{Math.round((step/5)*100)}%</div>
        </Card>
      )}
    </main>
  );
}
