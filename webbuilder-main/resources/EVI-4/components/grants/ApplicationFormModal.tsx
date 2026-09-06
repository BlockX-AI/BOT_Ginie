"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export type ApplicationFormValues = {
  name: string;
  email: string;
  project: string;
  repo?: string;
  summary: string;
};

export default function ApplicationFormModal({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults?: Partial<ApplicationFormValues>;
}) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<ApplicationFormValues>({
    name: defaults?.name || "",
    email: defaults?.email || "",
    project: defaults?.project || "",
    repo: defaults?.repo || "",
    summary: defaults?.summary || "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name || !values.email || !values.project || !values.summary) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/grants/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to submit");
      toast({ title: "Application submitted" });
      onOpenChange(false);
      setValues({ name: "", email: "", project: "", repo: "", summary: "" });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err?.message || "Try again later", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant Application</DialogTitle>
          <DialogDescription>Tell us briefly about you and your project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="app-name">Your Name</Label>
            <Input id="app-name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-email">Email</Label>
            <Input id="app-email" type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-project">Project Name</Label>
            <Input id="app-project" value={values.project} onChange={(e) => setValues((v) => ({ ...v, project: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-repo">Repository (optional)</Label>
            <Input id="app-repo" placeholder="https://github.com/..." value={values.repo} onChange={(e) => setValues((v) => ({ ...v, repo: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-summary">Summary</Label>
            <Textarea id="app-summary" className="min-h-[100px]" placeholder="What are you building? What's the impact?" value={values.summary} onChange={(e) => setValues((v) => ({ ...v, summary: e.target.value }))} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
