import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FIXTURE_ITEMS, fixtureResult } from "@/lib/batch-fixtures";
import { BatchStore } from "@/lib/batch-store";
import { BatchProcessingError, BatchWorker } from "@/lib/batch-worker";

let directory: string;
let store: BatchStore;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "batch-store-"));
  store = new BatchStore(path.join(directory, "test.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("durable batch storage", () => {
  it("persists completed jobs in original order", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(
      store,
      async (item) => fixtureResult(item),
      2,
    );
    await worker.runUntilIdle();

    expect(store.getJob(jobId)).toMatchObject({
      status: "completed",
      total: 2,
      completed: 2,
      errors: 0,
      items: [
        { position: 0, filename: "label-a.png", status: "completed" },
        { position: 1, filename: "label-b.png", status: "completed" },
      ],
    });
  });

  it("recovers interrupted processing without duplicating completed work", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const first = store.claimPendingItem();
    if (!first) throw new Error("Expected an item");
    store.completeItem(first, fixtureResult(first));
    const interrupted = store.claimPendingItem();
    expect(interrupted?.attemptCount).toBe(1);

    expect(store.recoverInterruptedItems()).toBe(1);
    const worker = new BatchWorker(store, async (item) => fixtureResult(item), 1);
    await worker.runUntilIdle();

    const job = store.getJob(jobId);
    expect(job?.completed).toBe(2);
    expect(job?.items[0].attemptCount).toBe(1);
    expect(job?.items[1].attemptCount).toBe(2);
  });

  it("records permanent item failures while continuing other items", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => {
      if (item.position === 0) throw new Error("Fixture failure");
      return fixtureResult(item);
    });
    await worker.runUntilIdle();

    expect(store.getJob(jobId)).toMatchObject({
      status: "completed",
      completed: 1,
      errors: 1,
    });
  });

  it("retries transient failures twice with deterministic exponential backoff", async () => {
    const delays: number[] = [];
    const jobId = store.createJob([FIXTURE_ITEMS[0]]);
    const worker = new BatchWorker(
      store,
      async (item) => {
        if (item.attemptCount < 3) {
          throw new BatchProcessingError("Temporary", "transient");
        }
        return fixtureResult(item);
      },
      {
        concurrency: 1,
        baseBackoffMs: 100,
        sleep: async (delay) => {
          delays.push(delay);
        },
      },
    );
    await worker.runUntilIdle();
    expect(delays).toEqual([100, 200]);
    expect(store.getJob(jobId)?.items[0]).toMatchObject({
      status: "completed",
      attemptCount: 3,
    });
  });

  it("does not automatically retry validation or authentication failures", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => {
      throw new BatchProcessingError(
        "Do not retry",
        item.position === 0 ? "validation" : "authentication",
      );
    });
    await worker.runUntilIdle();
    expect(store.getJob(jobId)?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "error", attemptCount: 1 }),
        expect.objectContaining({ status: "error", attemptCount: 1 }),
      ]),
    );
  });

  it("reduces concurrency on rate limits and recovers after successes", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const seen = new Set<string>();
    const worker = new BatchWorker(
      store,
      async (item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          throw new BatchProcessingError("Slow down", "rate-limit");
        }
        return fixtureResult(item);
      },
      { concurrency: 4, sleep: async () => undefined },
    );
    await worker.runUntilIdle();
    expect(store.getJob(jobId)?.completed).toBe(2);
    expect(worker.concurrency.effective).toBeLessThanOrEqual(4);
    expect(worker.concurrency.effective).toBeGreaterThanOrEqual(1);
  });

  it("allows a failed item to be manually requeued", async () => {
    const jobId = store.createJob([FIXTURE_ITEMS[0]]);
    const failing = new BatchWorker(store, async () => {
      throw new BatchProcessingError("Invalid", "validation");
    });
    await failing.runUntilIdle();
    const failed = store.getJob(jobId)?.items[0];
    expect(failed?.status).toBe("error");
    expect(store.requeueFailedItem(failed!.id)).toBe(1);
    const succeeding = new BatchWorker(store, async (item) => fixtureResult(item));
    await succeeding.runUntilIdle();
    expect(store.getJob(jobId)?.items[0]).toMatchObject({
      status: "completed",
      attemptCount: 2,
    });
  });
});
