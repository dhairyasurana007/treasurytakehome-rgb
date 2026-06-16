import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { runBatchWorker } from "@/lib/batch/runtime";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string; itemId: string }> },
) {
  const { jobId, itemId } = await context.params;
  const store = getBatchStore();
  const lookup = store.lookupJob(jobId);
  if (lookup.status === "expired") {
    return NextResponse.json({ error: "This batch job has expired." }, { status: 410 });
  }
  if (lookup.status === "unknown") {
    return NextResponse.json({ error: "This batch job was not found." }, { status: 404 });
  }
  if (!store.requeueFailedItem(itemId, jobId)) {
    return NextResponse.json(
      { error: "This item is not available for retry." },
      { status: 409 },
    );
  }
  runBatchWorker();
  return NextResponse.json({ status: "pending" });
}
