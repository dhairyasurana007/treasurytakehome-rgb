import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch-store";
import { ensureBatchRuntimeStarted } from "@/lib/runtime";

export function POST() {
  ensureBatchRuntimeStarted();
  const draft = getBatchStore().createDraft(
    new Date(),
    Number(process.env.DRAFT_RETENTION_HOURS ?? 2),
  );
  return NextResponse.json(draft, { status: 201 });
}
