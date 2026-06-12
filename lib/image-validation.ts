import { imageSize } from "image-size";

import { ValidationError } from "@/lib/validation-error";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;

export type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

export interface ValidatedImage {
  mimeType: SupportedImageType;
  width: number;
  height: number;
  bytes: Uint8Array;
}

function matches(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export function detectImageType(bytes: Uint8Array): SupportedImageType {
  if (bytes.length >= 3 && matches(bytes, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    matches(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  throw new ValidationError(
    "Choose a JPEG, PNG, or WebP image.",
    "unsupported-image-type",
  );
}

export function validateImageBytes(bytes: Uint8Array): ValidatedImage {
  if (bytes.length === 0) {
    throw new ValidationError("The selected image is empty.", "empty-image");
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      "The image must be 5 MB or smaller.",
      "image-too-large",
    );
  }

  const mimeType = detectImageType(bytes);
  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(bytes);
  } catch {
    throw new ValidationError(
      "The image is damaged or its dimensions cannot be read.",
      "invalid-image",
    );
  }

  const { width, height } = dimensions;
  if (!width || !height) {
    throw new ValidationError(
      "The image dimensions could not be read.",
      "invalid-image-dimensions",
    );
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new ValidationError(
      "The image must be 25 megapixels or smaller.",
      "image-too-many-pixels",
    );
  }

  return { mimeType, width, height, bytes };
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      "The image must be 5 MB or smaller.",
      "image-too-large",
    );
  }
  return validateImageBytes(new Uint8Array(await file.arrayBuffer()));
}
