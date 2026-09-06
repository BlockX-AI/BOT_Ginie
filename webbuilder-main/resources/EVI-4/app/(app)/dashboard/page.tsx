import { Button } from "@/components/ui/button";
import JobsTable, { Job } from "@/components/jobs/JobsTable";

export default function DashboardPage() {
  const jobs: Job[] = [
    { id: "job_1", contract: "ERC20", network: "basecamp", state: "completed", progress: 100, durationMs: 42000, updatedAt: new Date().toISOString() },
    { id: "job_2", contract: "NFT", network: "basecamp", state: "running", progress: 38, durationMs: 12000, updatedAt: new Date().toISOString() },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <Button>Generate My First dApp</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <h2 className="text-sm text-gray-400 mb-2">Recent Jobs</h2>
          <JobsTable jobs={jobs} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border p-4 bg-secondary/40">
            <h3 className="font-semibold mb-2">Network</h3>
            <p className="text-sm text-gray-400">Basecamp</p>
          </div>
          <div className="rounded-2xl border border-border p-4 bg-secondary/40">
            <h3 className="font-semibold mb-2">Account</h3>
            <p className="text-sm text-gray-400">Connect wallet or set API key</p>
          </div>
        </div>
      </div>
    </main>
  );
}
