import { NextResponse } from "next/server";

import { FIXTURE_ITEMS, fixtureResult } from "@/lib/batch-fixtures";
import { getBatchStore } from "@/lib/batch-store";
import { BatchProcessingError, BatchWorker } from "@/lib/batch-worker";

type Scenario = "transient" | "rate-limit" | "permanent" | "manual";

export async function POST(request: Request) {
  if (process.env.ENABLE_TEST_HARNESS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { scenario } = (await request.json()) as { scenario: Scenario };
  const store = getBatchStore();
  const jobId = store.createJob(FIXTURE_ITEMS);
  const observedAttempts = new Map<string, number>();
  const worker = new BatchWorker(
    store,
    async (item) => {
      const attempts = (observedAttempts.get(item.id) ?? 0) + 1;
      observedAttempts.set(item.id, attempts);
      if (item.position === 0 && attempts === 1) {
        if (scenario === "transient") {
          throw new BatchProcessingError("Temporary failure", "transient");
        }
        if (scenario === "rate-limit") {
          throw new BatchProcessingError("Rate limited", "rate-limit");
        }
        if (scenario === "permanent" || scenario === "manual") {
          throw new BatchProcessingError("Invalid fixture", "validation");
        }
      }
      return fixtureResult(item);
    },
    { concurrency: 4, baseBackoffMs: 1, sleep: async () => undefined },
  );
  await worker.runUntilIdle();

  if (scenario === "manual") {
    const failed = store.getJob(jobId)?.items.find((item) => item.status === "error");
    if (failed) {
      store.requeueFailedItem(failed.id);
      await worker.runUntilIdle();
    }
  }

  return NextResponse.json({
    job: store.getJob(jobId),
    concurrency: worker.concurrency,
  });
}
