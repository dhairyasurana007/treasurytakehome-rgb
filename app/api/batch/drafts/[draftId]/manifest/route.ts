import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { storeDraftManifest } from "@/lib/batch/draft-service";
import { ValidationError } from "@/lib/validation-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const file = (await request.formData()).get("manifest");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose a CSV manifest.", "manifest-missing");
    }
    const rows = await storeDraftManifest(getBatchStore(), draftId, file);
    return NextResponse.json({ rows: rows.length });
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : "The CSV could not be uploaded.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
