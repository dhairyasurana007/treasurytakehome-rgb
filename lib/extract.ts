import sharp from "sharp";
import OpenAI from "openai";

import { EXTRACTION_TOOL, extractedFieldsSchema } from "@/lib/extraction-schema";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import { ocrBboxes } from "@/lib/ocr-bbox";
import { tightenBboxes } from "@/lib/tighten-bbox";
import { FIELD_NAMES, type Bboxes, type ExtractedFields } from "@/lib/types";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const EXTRACTION_TIMEOUT_MS = 25_000;
// Keeps images within ~174k tokens (ceil(1024/32)^2 * 170) — safely under the model's 200k limit.
const MAX_MODEL_DIMENSION = 1024;

export class ExtractionConfigurationError extends Error {}
export class ExtractionProviderError extends Error {
  constructor(
    message: string,
    readonly timeout = false,
  ) {
    super(message);
  }
}

interface ExtractionOptions {
  mimeType: string;
  scenario?: "success" | "error" | "malformed";
}

const MOCK_EXTRACTION: ExtractedFields = {
  brand_name: "OLD TOM DISTILLERY",
  class_type: "Kentucky Straight Bourbon Whiskey",
  abv: "45% Alc./Vol. (90 Proof)",
  net_contents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  country: "United States",
  government_warning: CANONICAL_GOVERNMENT_WARNING,
  government_warning_prefix_bold: true,
  government_warning_legible: true,
  government_warning_prominent: true,
  bboxes: {
    brand_name: { x: 0.1, y: 0.05, w: 0.8, h: 0.12 },
    class_type: { x: 0.15, y: 0.2, w: 0.7, h: 0.08 },
    abv: { x: 0.3, y: 0.55, w: 0.4, h: 0.06 },
    net_contents: { x: 0.35, y: 0.63, w: 0.3, h: 0.06 },
    bottler: { x: 0.1, y: 0.72, w: 0.8, h: 0.06 },
    country: { x: 0.25, y: 0.79, w: 0.5, h: 0.05 },
    government_warning: { x: 0.05, y: 0.85, w: 0.9, h: 0.1 },
  },
};

export async function downscaleForModel(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { width, height } = await sharp(bytes).metadata();
  if (!width || !height || (width <= MAX_MODEL_DIMENSION && height <= MAX_MODEL_DIMENSION)) {
    return { bytes, mimeType };
  }
  const scale = MAX_MODEL_DIMENSION / Math.max(width, height);
  const resized = await sharp(bytes)
    .resize(Math.round(width * scale), Math.round(height * scale))
    .jpeg({ quality: 90 })
    .toBuffer();
  return { bytes: new Uint8Array(resized), mimeType: "image/jpeg" };
}

const OCR_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

// Resolve a box for each field, preferring deterministic OCR geometry and
// falling back to the model's own (width-trimmed) box where OCR cannot locate
// the text. OCR is time-boxed so a slow cold start never blocks the response.
async function resolveBboxes(
  bytes: Uint8Array,
  parsed: ExtractedFields,
): Promise<Bboxes | null> {
  const modelBoxes: Bboxes = parsed.bboxes
    ? await tightenBboxes(bytes, parsed.bboxes)
    : {};
  const ocr = await withTimeout(ocrBboxes(bytes, parsed), OCR_TIMEOUT_MS, {});

  const merged: Bboxes = {};
  let located = false;
  for (const field of FIELD_NAMES) {
    const box = ocr[field] ?? modelBoxes[field] ?? parsed.bboxes?.[field] ?? null;
    merged[field] = box;
    if (box) located = true;
  }
  return located ? merged : (parsed.bboxes ?? null);
}

function mockExtraction(scenario: ExtractionOptions["scenario"]) {
  if (scenario === "error") {
    throw new ExtractionProviderError("Mock provider failure.");
  }
  if (scenario === "malformed") {
    return extractedFieldsSchema.parse({ brand_name: "Incomplete" });
  }
  return MOCK_EXTRACTION;
}

function createClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ExtractionConfigurationError("OpenRouter is not configured.");
  }

  const defaultHeaders: Record<string, string> = {};
  if (process.env.OPENROUTER_SITE_URL) {
    defaultHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }
  if (process.env.OPENROUTER_APP_NAME) {
    defaultHeaders["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL,
    defaultHeaders,
  });
}

export async function extractLabelFields(
  bytes: Uint8Array,
  { mimeType, scenario = "success" }: ExtractionOptions,
): Promise<ExtractedFields> {
  if (process.env.EXTRACTION_MODE === "mock" && process.env.NODE_ENV !== "production") {
    return mockExtraction(scenario);
  }

  const client = createClient();
  const { bytes: processedBytes, mimeType: processedMimeType } = await downscaleForModel(bytes, mimeType);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.MODEL_ID ?? DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Extract only text and visual evidence visibly present on this alcohol label. Preserve exact wording and capitalization. Use null when a field or visual property cannot be determined. For each text field you locate, also provide its bounding box as fractions of image width and height (x, y, w, h in range 0–1, where x/y is the top-left corner). Fit each box tightly to the inked glyphs of that field's value only. The left edge must sit at the leftmost visible pixel of the first character and the right edge at the rightmost visible pixel of the last character — exclude all leading and trailing whitespace, padding, and any blank area that runs to the edge of the line or column. Do not extend a box to cover the full width of the line, the column, or neighbouring text; bound only this field's own characters. The height must wrap only the lines of this field's text. Only supply a bbox when you can locate the text with high confidence.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this label and record every requested field.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${processedMimeType};base64,${Buffer.from(processedBytes).toString("base64")}`,
                },
              },
            ],
          },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: {
          type: "function",
          function: { name: EXTRACTION_TOOL.function.name },
        },
        temperature: 0,
      },
      { signal: controller.signal },
    );

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new ExtractionProviderError(
        "The vision provider did not return structured label fields.",
      );
    }
    const parsed = extractedFieldsSchema.parse(
      JSON.parse(toolCall.function.arguments),
    );
    const bboxes = await resolveBboxes(processedBytes, parsed);
    return { ...parsed, bboxes };
  } catch (error) {
    if (error instanceof ExtractionProviderError) throw error;
    if (controller.signal.aborted) {
      throw new ExtractionProviderError(
        "The vision provider took too long to respond.",
        true,
      );
    }
    throw new ExtractionProviderError(
      "The vision provider could not analyze this label.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
