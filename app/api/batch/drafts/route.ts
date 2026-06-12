import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch-store";

export function POST() {
  const draft = getBatchStore().createDraft(
    new Date(),
    Number(process.env.DRAFT_RETENTION_HOURS ?? 2),
  );
  return NextResponse.json(draft, { status: 201 });
}
