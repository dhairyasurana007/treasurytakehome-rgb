import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { ensureBatchRuntimeStarted } from "@/lib/batch/runtime";

export function POST() {
  ensureBatchRuntimeStarted();
  const draft = getBatchStore().createDraft(
    new Date(),
    Number(process.env.DRAFT_RETENTION_HOURS ?? 2),
  );
  return NextResponse.json(draft, { status: 201 });
}
