"use client";

import { useState } from "react";

export default function BatchRetryHarness() {
  const [message, setMessage] = useState("Choose a failure scenario.");

  async function run(scenario: string) {
    const response = await fetch("/api/test-harness/batch-retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    const body = (await response.json()) as {
      job: {
        completed: number;
        errors: number;
        items: Array<{ attemptCount: number }>;
      };
      concurrency: { configured: number; effective: number };
    };
    setMessage(
      `${scenario}: completed ${body.job.completed}, errors ${body.job.errors}, attempts ${body.job.items.map((item) => item.attemptCount).join("/")}, concurrency ${body.concurrency.effective}/${body.concurrency.configured}`,
    );
  }

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Batch retry harness</h1>
      <div className="harness-actions">
        {["transient", "rate-limit", "permanent", "manual"].map((scenario) => (
          <button
            className="primary-button"
            key={scenario}
            type="button"
            onClick={() => run(scenario)}
          >
            Run {scenario}
          </button>
        ))}
      </div>
      <p data-testid="retry-result">{message}</p>
    </main>
  );
}
