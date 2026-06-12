"use client";

import { useState } from "react";

export default function BatchExpiryHarness() {
  const [result, setResult] = useState("Ready.");

  async function verifyExpiry() {
    const created = await fetch("/api/test-harness/batch-expiry", {
      method: "POST",
    }).then((response) => response.json());
    const expired = await fetch(`/api/batch/${created.jobId}`);
    const unknown = await fetch("/api/batch/unknown-fixture-job");
    setResult(
      `Expired: ${expired.status}. Unknown: ${unknown.status}. Retained rows: ${created.retained.count}.`,
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">Batch expiry harness</h1>
      <button
        className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-white"
        onClick={verifyExpiry}
        type="button"
      >
        Verify expiry
      </button>
      <p className="mt-4" data-testid="expiry-result">
        {result}
      </p>
    </main>
  );
}
