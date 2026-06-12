import { NextResponse } from "next/server";

import { validateApplicationData } from "@/lib/application-validation";
import { validateImageFile } from "@/lib/image-validation";
import { ValidationError } from "@/lib/validation-error";

export async function POST(request: Request) {
  if (process.env.ENABLE_TEST_HARNESS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const applicationData = formData.get("applicationData");
    if (!(image instanceof File) || typeof applicationData !== "string") {
      throw new ValidationError(
        "Choose an image and provide application details.",
        "missing-input",
      );
    }

    const [validatedImage] = await Promise.all([
      validateImageFile(image),
      Promise.resolve(validateApplicationData(JSON.parse(applicationData))),
    ]);

    return NextResponse.json({
      valid: true,
      modelSubmitted: false,
      image: {
        mimeType: validatedImage.mimeType,
        width: validatedImage.width,
        height: validatedImage.height,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Application details are not valid JSON.", modelSubmitted: false },
        { status: 400 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, modelSubmitted: false },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "The upload could not be validated.", modelSubmitted: false },
      { status: 400 },
    );
  }
}
