import OpenAI from "openai";

import { EXTRACTION_TOOL, extractedFieldsSchema } from "@/lib/extraction-schema";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type { ExtractedFields } from "@/lib/types";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const EXTRACTION_TIMEOUT_MS = 4_000;

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
};

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
  if (process.env.EXTRACTION_MODE === "mock") {
    return mockExtraction(scenario);
  }

  const client = createClient();
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
              "Extract only text and visual evidence visibly present on this alcohol label. Preserve exact wording and capitalization. Use null when a field or visual property cannot be determined.",
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
                  url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
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
    return extractedFieldsSchema.parse(JSON.parse(toolCall.function.arguments));
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
