"use client";

import StatusChip from "@/components/common/StatusChip";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export type Job = {
  id: string;
  contract: string;
  network: string;
  state: "queued" | "running" | "failed" | "completed";
  progress: number;
  durationMs: number;
  updatedAt: string;
};

type Props = {
  jobs: Job[];
};

export default function JobsTable({ jobs }: Props) {
  return (
    <Card className="p-4 bg-secondary/40 border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400">
            <tr>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Contract</th>
              <th className="py-2 pr-4">Network</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Progress</th>
              <th className="py-2 pr-4">Duration</th>
              <th className="py-2 pr-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-border/60">
                <td className="py-2 pr-4 font-mono text-xs">
                  <Link href={`/jobs/${j.id}`} className="text-primary hover:underline">
                    {j.id}
                  </Link>
                </td>
                <td className="py-2 pr-4">{j.contract}</td>
                <td className="py-2 pr-4">{j.network}</td>
                <td className="py-2 pr-4"><StatusChip state={j.state} /></td>
                <td className="py-2 pr-4">{j.progress}%</td>
                <td className="py-2 pr-4">{Math.round(j.durationMs / 1000)}s</td>
                <td className="py-2 pr-4">{new Date(j.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
