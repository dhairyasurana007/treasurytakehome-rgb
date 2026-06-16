import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { storeDraftImage } from "@/lib/batch/draft-service";
import { ValidationError } from "@/lib/validation-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const file = (await request.formData()).get("image");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose an image.", "image-missing");
    }
    return NextResponse.json(
      await storeDraftImage(getBatchStore(), draftId, file),
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof ValidationError
        ? error.message
        : "The image could not be uploaded.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
