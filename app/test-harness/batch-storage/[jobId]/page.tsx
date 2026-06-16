import { notFound } from "next/navigation";

import { getBatchStore } from "@/lib/batch/batch-store";

export const dynamic = "force-dynamic";

export default async function StoredJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  const { jobId } = await params;
  const job = getBatchStore().getJob(jobId);
  if (!job) notFound();

  return (
    <main className="harness-shell">
      <p className="section-label">Persisted fixture job</p>
      <h1>Batch job {job.id}</h1>
      <p data-testid="stored-job-status">
        {job.completed} of {job.total} completed. Status: {job.status}.
      </p>
      <ul className="stored-items">
        {job.items.map((item) => (
          <li key={item.id}>
            <strong>{item.filename}</strong>
            <span>{item.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
