import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FIXTURE_ITEMS } from "@/lib/batch-fixtures";
import { BatchStore } from "@/lib/batch-store";

let directory: string;
let store: BatchStore;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "batch-cleanup-"));
  process.env.DATA_DIR = directory;
  process.env.TOMBSTONE_SECRET = "test-tombstone-secret";
  store = new BatchStore(path.join(directory, "test.sqlite"));
});

afterEach(() => {
  store.close();
  delete process.env.DATA_DIR;
  delete process.env.TOMBSTONE_SECRET;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("batch retention cleanup", () => {
  it("deletes expired job data and image files while retaining only a hash", () => {
    const imagePath = path.join(directory, "label.png");
    fs.writeFileSync(imagePath, "fixture");
    const created = new Date("2026-06-10T00:00:00.000Z");
    const jobId = store.createJob(
      [{ ...FIXTURE_ITEMS[0], imagePath }],
      created,
      24,
    );

    expect(
      store.cleanupExpired(new Date("2026-06-11T00:00:00.000Z")),
    ).toEqual({ jobs: 1, drafts: 0 });
    expect(fs.existsSync(imagePath)).toBe(false);
    expect(store.lookupJob(jobId).status).toBe("expired");
    expect(
      store.database.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId),
    ).toBeUndefined();
    expect(
      store.database.prepare("SELECT * FROM items WHERE job_id = ?").all(jobId),
    ).toEqual([]);
    const tombstone = store.database
      .prepare("SELECT * FROM tombstones")
      .get() as Record<string, string>;
    expect(tombstone.id_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(tombstone)).not.toContain(jobId);
    expect(JSON.stringify(tombstone)).not.toContain("label");
  });

  it("enforces exact expiry during lookup and distinguishes unknown IDs", () => {
    const created = new Date("2026-06-10T00:00:00.000Z");
    const jobId = store.createJob(FIXTURE_ITEMS, created, 24);
    expect(
      store.lookupJob(jobId, new Date("2026-06-10T23:59:59.999Z")).status,
    ).toBe("found");
    expect(
      store.lookupJob(jobId, new Date("2026-06-11T00:00:00.000Z")).status,
    ).toBe("expired");
    expect(store.lookupJob("never-issued").status).toBe("unknown");
  });

  it("deletes abandoned drafts and their files", () => {
    const created = new Date("2026-06-10T00:00:00.000Z");
    const draft = store.createDraft(created, 1);
    const draftDirectory = path.join(directory, "drafts", draft.id);
    fs.mkdirSync(draftDirectory, { recursive: true });
    const filePath = path.join(draftDirectory, "fixture.upload");
    fs.writeFileSync(filePath, "fixture");
    store.addDraftFile(draft.id, {
      filename: "label.png",
      normalizedFilename: "label.png",
      path: filePath,
      checksum: "checksum",
      mimeType: "image/png",
      width: 1,
      height: 1,
    });

    expect(
      store.cleanupExpired(new Date("2026-06-10T01:00:00.000Z")),
    ).toEqual({ jobs: 0, drafts: 1 });
    expect(store.getDraft(draft.id)).toBeNull();
    expect(fs.existsSync(draftDirectory)).toBe(false);
  });

  it("removes old tombstones after the brief retention window", () => {
    const created = new Date("2026-06-10T00:00:00.000Z");
    const jobId = store.createJob(FIXTURE_ITEMS, created, 0);
    store.cleanupExpired(created);
    expect(store.lookupJob(jobId).status).toBe("expired");
    store.cleanupExpired(new Date("2026-06-12T00:00:00.001Z"), 48);
    expect(store.lookupJob(jobId).status).toBe("unknown");
  });
});
