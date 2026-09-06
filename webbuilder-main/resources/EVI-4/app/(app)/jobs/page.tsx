import JobsTable, { Job } from "@/components/jobs/JobsTable";

export default function JobsPage() {
  const jobs: Job[] = [
    { id: "job_1", contract: "ERC20", network: "camp-testnet", state: "completed", progress: 100, durationMs: 42000, updatedAt: new Date().toISOString() },
    { id: "job_2", contract: "NFT", network: "camp-testnet", state: "failed", progress: 72, durationMs: 32000, updatedAt: new Date().toISOString() },
    { id: "job_3", contract: "DAO", network: "basecamp", state: "running", progress: 15, durationMs: 8000, updatedAt: new Date().toISOString() },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-4">
      <h1 className="font-heading text-3xl font-bold">Jobs</h1>
      <JobsTable jobs={jobs} />
    </main>
  );
}
