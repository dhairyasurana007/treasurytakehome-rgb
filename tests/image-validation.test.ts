import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BYTES,
  detectImageType,
  validateImageBytes,
} from "@/lib/image-validation";
import { ValidationError } from "@/lib/validation-error";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function pngHeader(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe("image validation", () => {
  it("accepts a valid PNG by bytes rather than filename", () => {
    expect(validateImageBytes(PNG_1X1)).toMatchObject({
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
  });

  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [pngHeader(1, 1), "image/png"],
    [Buffer.from("524946460000000057454250", "hex"), "image/webp"],
  ])("recognizes supported signatures", (bytes, mimeType) => {
    expect(detectImageType(bytes)).toBe(mimeType);
  });

  it("rejects renamed non-image bytes", () => {
    expect(() => validateImageBytes(Buffer.from("not an image"))).toThrowError(
      ValidationError,
    );
  });

  it("rejects files over 5 MB before metadata parsing", () => {
    expect(() => validateImageBytes(new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow(
      "5 MB or smaller",
    );
  });

  it("rejects images over 25 megapixels", () => {
    expect(() => validateImageBytes(pngHeader(6000, 5000))).toThrow(
      "25 megapixels or smaller",
    );
  });
});
