"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BatchStorageHarness() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createJob() {
    setCreating(true);
    const response = await fetch("/api/test-harness/batch-storage", {
      method: "POST",
    });
    const body = (await response.json()) as { jobId: string };
    router.push(`/test-harness/batch-storage/${body.jobId}`);
  }

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Durable batch storage harness</h1>
      <p>Create a fixture job, then reload or reopen its URL.</p>
      <button
        className="primary-button"
        type="button"
        disabled={creating}
        onClick={createJob}
      >
        {creating ? "Creating job..." : "Create fixture job"}
      </button>
    </main>
  );
}
