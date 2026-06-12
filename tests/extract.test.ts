import { afterEach, describe, expect, it } from "vitest";

import {
  extractLabelFields,
  ExtractionConfigurationError,
  ExtractionProviderError,
} from "@/lib/extract";

const originalMode = process.env.EXTRACTION_MODE;
const originalKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  process.env.EXTRACTION_MODE = originalMode;
  process.env.OPENROUTER_API_KEY = originalKey;
});

describe("vision extraction", () => {
  it("returns a complete deterministic extraction in mock mode", async () => {
    process.env.EXTRACTION_MODE = "mock";
    await expect(
      extractLabelFields(new Uint8Array([1]), { mimeType: "image/png" }),
    ).resolves.toMatchObject({
      brand_name: "OLD TOM DISTILLERY",
      government_warning_prefix_bold: true,
    });
  });

  it("surfaces provider failures without leaking configuration", async () => {
    process.env.EXTRACTION_MODE = "mock";
    await expect(
      extractLabelFields(new Uint8Array([1]), {
        mimeType: "image/png",
        scenario: "error",
      }),
    ).rejects.toBeInstanceOf(ExtractionProviderError);
  });

  it("requires a server-side key in live mode", async () => {
    delete process.env.EXTRACTION_MODE;
    delete process.env.OPENROUTER_API_KEY;
    await expect(
      extractLabelFields(new Uint8Array([1]), { mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(ExtractionConfigurationError);
  });
});
