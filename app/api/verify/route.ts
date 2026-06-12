import { NextResponse } from "next/server";

import { validateApplicationData } from "@/lib/application-validation";
import { compareFields } from "@/lib/compare";
import {
  extractLabelFields,
  ExtractionConfigurationError,
  ExtractionProviderError,
} from "@/lib/extract";
import { validateImageFile } from "@/lib/image-validation";
import { ValidationError } from "@/lib/validation-error";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const applicationJson = formData.get("applicationData");
    if (!(image instanceof File) || typeof applicationJson !== "string") {
      throw new ValidationError(
        "Choose a label image and enter the application details.",
        "missing-input",
      );
    }

    const application = validateApplicationData(JSON.parse(applicationJson));
    const validatedImage = await validateImageFile(image);
    const requestedScenario = request.headers.get("x-test-provider-scenario");
    const scenario =
      process.env.ENABLE_TEST_HARNESS === "true" &&
      (requestedScenario === "error" || requestedScenario === "malformed")
        ? requestedScenario
        : "success";
    const extracted = await extractLabelFields(validatedImage.bytes, {
      mimeType: validatedImage.mimeType,
      scenario,
    });

    return NextResponse.json(compareFields(extracted, application));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Application details are not valid JSON." },
        { status: 400 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    if (error instanceof ExtractionConfigurationError) {
      return NextResponse.json(
        { error: "Label analysis is not configured." },
        { status: 500 },
      );
    }
    if (error instanceof ExtractionProviderError) {
      return NextResponse.json(
        { error: "The label could not be analyzed. Please try again." },
        { status: error.timeout ? 504 : 502 },
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
