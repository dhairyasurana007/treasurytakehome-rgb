import { describe, expect, it } from "vitest";

import { extractLabelFields } from "@/lib/extract";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter live smoke", () => {
  it("returns structured fields without exposing credentials", async () => {
    delete process.env.EXTRACTION_MODE;
    const result = await extractLabelFields(PNG_1X1, {
      mimeType: "image/png",
    });
    expect(result).toHaveProperty("government_warning");
  }, 15_000);
});
