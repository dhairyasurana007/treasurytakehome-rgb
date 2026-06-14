import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  downscaleForModel,
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

describe("downscaleForModel", () => {
  async function makePng(width: number, height: number): Promise<Uint8Array> {
    const buf = await sharp({
      create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .png()
      .toBuffer();
    return new Uint8Array(buf);
  }

  it("downscales an oversized image to fit within 1024px and converts to JPEG", async () => {
    const input = await makePng(2000, 2000);
    const { bytes, mimeType } = await downscaleForModel(input, "image/png");
    const meta = await sharp(bytes).metadata();
    expect(meta.width).toBeLessThanOrEqual(1024);
    expect(meta.height).toBeLessThanOrEqual(1024);
    expect(mimeType).toBe("image/jpeg");
  });

  it("preserves aspect ratio when downscaling a non-square image", async () => {
    const input = await makePng(2000, 1000);
    const { bytes } = await downscaleForModel(input, "image/png");
    const meta = await sharp(bytes).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(512);
  });

  it("returns original bytes and mimeType unchanged when image is within limits", async () => {
    const input = await makePng(800, 600);
    const result = await downscaleForModel(input, "image/png");
    expect(result.bytes).toBe(input);
    expect(result.mimeType).toBe("image/png");
  });
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
