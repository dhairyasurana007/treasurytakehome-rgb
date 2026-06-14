"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BatchJobView } from "@/lib/batch-types";

const RECENT_JOBS_KEY = "ttb-recent-batch-jobs";

export default function BatchJobViewComponent({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<BatchJobView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "expired" | "unknown" | "error">("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/batch/${jobId}`, { cache: "no-store" });
      if (response.status === 410) {
        const recent = JSON.parse(
          window.localStorage.getItem(RECENT_JOBS_KEY) ?? "[]",
        ) as Array<{ id: string }>;
        window.localStorage.setItem(
          RECENT_JOBS_KEY,
          JSON.stringify(recent.filter((item) => item.id !== jobId)),
        );
        setState("expired");
        return;
      }
      if (response.status === 404) {
        setState("unknown");
        return;
      }
      if (!response.ok) throw new Error();
      const next = (await response.json()) as BatchJobView;
      setJob(next);
      setState("ready");
    } catch {
      setMessage("Progress could not be refreshed. We will keep trying.");
      setState((current) => (current === "ready" ? current : "error"));
    }
  }, [jobId]);

  useEffect(() => {
    if (job?.status === "completed") return;
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 1_000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [job?.status, load]);

  const processed = (job?.completed ?? 0) + (job?.errors ?? 0);
  const remaining = Math.max(0, (job?.total ?? 0) - processed);
  const estimate = useMemo(
    () => Math.ceil((remaining * 5) / 4),
    [remaining],
  );

  async function retry(itemId: string) {
    const response = await fetch(`/api/batch/${jobId}/items/${itemId}/retry`, {
      method: "POST",
    });
    if (!response.ok) {
      setMessage("The item could not be retried.");
      return;
    }
    setMessage("Retry started.");
    await load();
  }

  if (state === "loading") return <main className="job-shell"><p>Loading batch progress...</p></main>;
  if (state === "expired") {
    return (
      <main className="job-shell">
        <p className="section-label">Batch unavailable</p>
        <h1>This batch job has expired.</h1>
        <p>Its images, application values, and results have been deleted.</p>
        <Link href="/">Start another batch</Link>
      </main>
    );
  }
  if (state === "unknown") {
    return (
      <main className="job-shell">
        <p className="section-label">Batch unavailable</p>
        <h1>Batch job not found.</h1>
        <p>Check the link or return to the batch upload screen.</p>
        <Link href="/">Return home</Link>
      </main>
    );
  }
  if (!job) return <main className="job-shell"><p>{message || "Unable to load this batch."}</p></main>;

  return (
    <main className="job-shell">
      <div className="job-heading">
        <div>
          <p className="section-label">Durable batch job</p>
          <h1>Label verification progress</h1>
          <p data-testid="job-progress">
            {processed} of {job.total} processed. Status: {job.status}.
          </p>
        </div>
        <Link className="secondary-link" href="/">New verification</Link>
      </div>
      <section className="job-summary">
        <div>
          <span>Processed</span>
          <strong>{processed} / {job.total}</strong>
        </div>
        <div>
          <span>Estimated time remaining</span>
          <strong>{remaining ? `About ${estimate} seconds` : "Complete"}</strong>
        </div>
        <div>
          <span>Available until</span>
          <strong>{new Date(job.expiresAt).toLocaleString()}</strong>
        </div>
      </section>
      <section className="job-link-panel">
        <div>
          <h2>Save this job link</h2>
          <p>Anyone with this unguessable link can view results until expiry.</p>
        </div>
        <div className="job-link-actions">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
          >
            {copied ? "Link copied" : "Copy job link"}
          </button>
          <a
            href={`/api/batch/${jobId}/export`}
            download
            className="secondary-link"
            aria-label={
              job.status === "completed"
                ? "Download results as CSV"
                : "Download partial results as CSV"
            }
          >
            {job.status === "completed"
              ? "Download results"
              : "Download partial results"}
          </a>
        </div>
      </section>
      {message && <p className="job-message" role="status">{message}</p>}
      <section aria-labelledby="batch-items-heading">
        <h2 id="batch-items-heading">Labels in CSV order</h2>
        <ol className="batch-items">
          {job.items.map((item) => (
            <li key={item.id} data-testid="batch-item">
              <div>
                <strong>{item.filename}</strong>
                <span className={`item-status item-${item.status}`}>{item.status}</span>
              </div>
              {item.result && <p>Overall result: {item.result.overall_status.replace("-", " ")}</p>}
              {item.error && <p className="item-error">{item.error}</p>}
              {item.status === "error" && (
                <button type="button" onClick={() => retry(item.id)}>
                  Retry this label
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
