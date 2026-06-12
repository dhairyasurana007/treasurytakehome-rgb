import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch-store";
import { finalizeDraft } from "@/lib/draft-service";
import { runBatchWorker } from "@/lib/runtime";
import { ValidationError } from "@/lib/validation-error";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const store = getBatchStore();
    const jobId = finalizeDraft(store, draftId);
    const job = store.getJob(jobId);
    runBatchWorker();
    return NextResponse.json(
      { jobId, expiresAt: job?.expiresAt },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof ValidationError
        ? error.message
        : "The batch could not be finalized.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
