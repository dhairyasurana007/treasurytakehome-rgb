"use client";

import { useState, type FormEvent } from "react";

async function readJson(response: Response) {
  const body = (await response.json()) as { error?: string; jobId?: string };
  if (!response.ok) throw new Error(body.error ?? "Upload failed.");
  return body;
}

export default function BatchUploadHarness() {
  const [message, setMessage] = useState("Choose a CSV and its images.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creating draft...");
    try {
      const form = new FormData(event.currentTarget);
      const manifest = form.get("manifest");
      const images = form.getAll("images");
      const draft = (await (
        await fetch("/api/batch/drafts", { method: "POST" })
      ).json()) as { id: string };

      const manifestForm = new FormData();
      manifestForm.set("manifest", manifest as File);
      await readJson(
        await fetch(`/api/batch/drafts/${draft.id}/manifest`, {
          method: "POST",
          body: manifestForm,
        }),
      );
      for (let index = 0; index < images.length; index += 1) {
        setMessage(`Uploading image ${index + 1} of ${images.length}...`);
        const imageForm = new FormData();
        imageForm.set("image", images[index]);
        await readJson(
          await fetch(`/api/batch/drafts/${draft.id}/images`, {
            method: "POST",
            body: imageForm,
          }),
        );
      }
      const finalized = await readJson(
        await fetch(`/api/batch/drafts/${draft.id}/finalize`, { method: "POST" }),
      );
      setMessage(`Batch finalized: ${finalized.jobId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Atomic batch upload harness</h1>
      <form className="validation-harness" onSubmit={submit}>
        <label htmlFor="batch-manifest">CSV manifest</label>
        <input id="batch-manifest" name="manifest" type="file" accept=".csv" required />
        <label htmlFor="batch-images">Label images</label>
        <input id="batch-images" name="images" type="file" multiple required />
        <button type="submit">Upload and finalize</button>
      </form>
      <p data-testid="batch-upload-result">{message}</p>
    </main>
  );
}
