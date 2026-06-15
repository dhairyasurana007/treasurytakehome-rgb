"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

interface RecentJob {
  id: string;
  label: string;
  expiresAt: string;
}

const RECENT_JOBS_KEY = "ttb-recent-batch-jobs";

function readRecentJobs() {
  try {
    const jobs = JSON.parse(
      window.localStorage.getItem(RECENT_JOBS_KEY) ?? "[]",
    ) as RecentJob[];
    const active = jobs.filter(
      (job) => new Date(job.expiresAt).getTime() > Date.now(),
    );
    window.localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(active));
    return active;
  } catch {
    return [];
  }
}

async function responseJson(response: Response) {
  const body = (await response.json()) as {
    error?: string;
    id?: string;
    jobId?: string;
    expiresAt?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "The upload could not be completed.");
  return body;
}

async function uploadImage(draftId: string, image: File) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const imageForm = new FormData();
      imageForm.set("image", image);
      const response = await fetch(`/api/batch/drafts/${draftId}/images`, {
        method: "POST",
        body: imageForm,
      });
      if (response.status < 500) return await responseJson(response);
      lastError = new Error("The image service is temporarily unavailable.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("The image could not be uploaded.");
}

export default function BatchWorkspace() {
  const router = useRouter();
  const [manifest, setManifest] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [status, setStatus] = useState("Choose a CSV and its matching images.");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setRecentJobs(readRecentJobs()), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const imageSummary = useMemo(
    () =>
      images.length
        ? `${images.length} image${images.length === 1 ? "" : "s"} selected`
        : "No images selected",
    [images],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manifest || !images.length) {
      setError("Choose one CSV file and at least one label image.");
      return;
    }
    if (manifest.size > 1024 * 1024) {
      setError("The CSV file must be 1 MB or smaller.");
      return;
    }
    const names = images.map((file) => file.name.toLocaleLowerCase("en-US"));
    if (new Set(names).size !== names.length) {
      setError("Image filenames must be unique, ignoring capitalization.");
      return;
    }
    if (images.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each image must be 5 MB or smaller.");
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);
    try {
      setStatus("Creating a secure upload draft...");
      const draft = await responseJson(
        await fetch("/api/batch/drafts", { method: "POST" }),
      );
      const manifestForm = new FormData();
      manifestForm.set("manifest", manifest);
      await responseJson(
        await fetch(`/api/batch/drafts/${draft.id}/manifest`, {
          method: "POST",
          body: manifestForm,
        }),
      );
      setProgress(1 / (images.length + 2));

      for (let index = 0; index < images.length; index += 1) {
        setStatus(`Uploading image ${index + 1} of ${images.length}...`);
        await uploadImage(draft.id!, images[index]);
        setProgress((index + 2) / (images.length + 2));
      }

      setStatus("Finalizing the durable batch job...");
      const finalized = await responseJson(
        await fetch(`/api/batch/drafts/${draft.id}/finalize`, {
          method: "POST",
        }),
      );
      setProgress(1);
      const job: RecentJob = {
        id: finalized.jobId!,
        label: manifest.name,
        expiresAt: finalized.expiresAt!,
      };
      const next = [job, ...readRecentJobs().filter((item) => item.id !== job.id)].slice(0, 10);
      window.localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(next));
      router.push(`/batch/${job.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upload could not be completed.");
      setStatus("Upload stopped. Correct the issue and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="batch-workspace" data-testid="batch-panel">
      <div className="form-intro">
        <div>
          <p className="section-label">Batch review</p>
          <h2>Check multiple labels</h2>
          <p>Upload one CSV manifest and every matching label image.</p>
        </div>
        <span>1–300 labels</span>
      </div>
      <form onSubmit={submit}>
        <section className="form-section">
          <div className="step-heading">
            <span>1</span>
            <div>
              <h3>Choose the CSV manifest</h3>
              <p>UTF-8 CSV, no larger than 1 MB.</p>
            </div>
          </div>
          <label className="batch-file-field">
            <span>CSV manifest</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setManifest(event.target.files?.[0] ?? null)}
            />
            <small>{manifest?.name ?? "No CSV selected"}</small>
          </label>
        </section>
        <section className="form-section">
          <div className="step-heading">
            <span>2</span>
            <div>
              <h3>Choose matching label images</h3>
              <p>JPEG, PNG, or WebP. Each image can be up to 5 MB.</p>
            </div>
          </div>
          <label className="batch-file-field">
            <span>Label images</span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(event) => setImages(Array.from(event.target.files ?? []))}
            />
            <small>{imageSummary}</small>
          </label>
          <p className="retention-note">
            After finalization, processing continues if you close this tab. Job
            data and images expire 24 hours after creation.
          </p>
        </section>
        {uploading && (
          <div className="upload-progress" role="status">
            <div>
              <strong>{status}</strong>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <progress value={progress} max={1} />
            <p>Keep this tab open until finalization finishes.</p>
          </div>
        )}
        {error && (
          <div className="request-error" role="alert">
            <strong>We could not create the batch.</strong>
            <p>{error}</p>
          </div>
        )}
        <div className="form-actions">
          <p>Only finalized jobs appear in your recent jobs list.</p>
          <button className="primary-button" disabled={uploading || !manifest || !images.length} type="submit">
            {uploading ? "Uploading batch..." : "Create batch job"}
          </button>
        </div>
      </form>
      {recentJobs.length > 0 && (
        <section className="recent-jobs" aria-labelledby="recent-jobs-heading">
          <h3 id="recent-jobs-heading">Recent batch jobs</h3>
          <ul>
            {recentJobs.map((job) => (
              <li key={job.id}>
                <Link href={`/batch/${job.id}`}>{job.label}</Link>
                <span>Expires {new Date(job.expiresAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
