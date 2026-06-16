import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { runBatchWorker } from "@/lib/batch/runtime";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  runBatchWorker();
  const { jobId } = await context.params;
  const lookup = getBatchStore().lookupJob(jobId);
  if (lookup.status === "expired") {
    return NextResponse.json(
      { error: "This batch job has expired." },
      { status: 410 },
    );
  }
  if (lookup.status === "unknown") {
    return NextResponse.json(
      { error: "This batch job was not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(lookup.job);
}
