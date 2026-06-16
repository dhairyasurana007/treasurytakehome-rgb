import { NextResponse } from "next/server";

import { FIXTURE_ITEMS, fixtureResult } from "@/lib/batch/batch-fixtures";
import { getBatchStore } from "@/lib/batch/batch-store";
import { BatchWorker } from "@/lib/batch/batch-worker";

export async function POST() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const store = getBatchStore();
  const jobId = store.createJob(FIXTURE_ITEMS);
  const worker = new BatchWorker(
    store,
    async (item) => fixtureResult(item),
    2,
  );
  await worker.runUntilIdle();
  return NextResponse.json({ jobId });
}
