import { z } from "zod";

const bboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const extractedFieldsSchema = z.object({
  brand_name: z.string().nullable(),
  class_type: z.string().nullable(),
  abv: z.string().nullable(),
  net_contents: z.string().nullable(),
  bottler: z.string().nullable(),
  country: z.string().nullable(),
  government_warning: z.string().nullable(),
  government_warning_prefix_bold: z.boolean().nullable(),
  government_warning_legible: z.boolean().nullable(),
  government_warning_prominent: z.boolean().nullable(),
  bboxes: z
    .object({
      brand_name: bboxSchema.nullable().optional(),
      class_type: bboxSchema.nullable().optional(),
      abv: bboxSchema.nullable().optional(),
      net_contents: bboxSchema.nullable().optional(),
      bottler: bboxSchema.nullable().optional(),
      country: bboxSchema.nullable().optional(),
      government_warning: bboxSchema.nullable().optional(),
    })
    .optional()
    .nullable(),
});

const BBOX_PROPERTY = {
  type: ["object", "null"],
  description: "Location as fractions of image size, or null if uncertain.",
  additionalProperties: false,
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
  },
  required: ["x", "y", "w", "h"],
} as const;

const FIELD_PROPERTIES = {
  brand_name: { type: ["string", "null"] },
  class_type: { type: ["string", "null"] },
  abv: { type: ["string", "null"] },
  net_contents: { type: ["string", "null"] },
  bottler: { type: ["string", "null"] },
  country: { type: ["string", "null"] },
  government_warning: { type: ["string", "null"] },
  government_warning_prefix_bold: { type: ["boolean", "null"] },
  government_warning_legible: { type: ["boolean", "null"] },
  government_warning_prominent: { type: ["boolean", "null"] },
} as const;

const BBOXES_PROPERTY = {
  type: ["object", "null"],
  description:
    "Bounding boxes for text fields as fractions of image width/height (0–1). Provide coordinates only when you can locate the text with high confidence; use null for fields you cannot find.",
  additionalProperties: false,
  properties: {
    brand_name: BBOX_PROPERTY,
    class_type: BBOX_PROPERTY,
    abv: BBOX_PROPERTY,
    net_contents: BBOX_PROPERTY,
    bottler: BBOX_PROPERTY,
    country: BBOX_PROPERTY,
    government_warning: BBOX_PROPERTY,
  },
} as const;

const REQUIRED_FIELDS = [
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler",
  "country",
  "government_warning",
  "government_warning_prefix_bold",
  "government_warning_legible",
  "government_warning_prominent",
];

// Omit the bboxes property when the caller will not display boxes, so the model
// does not spend output tokens generating coordinates we would discard.
function buildExtractionTool(includeBboxes: boolean) {
  return {
    type: "function" as const,
    function: {
      name: "record_label_fields",
      description:
        "Record alcohol label fields exactly as visibly printed on the supplied artwork.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: includeBboxes
          ? { ...FIELD_PROPERTIES, bboxes: BBOXES_PROPERTY }
          : { ...FIELD_PROPERTIES },
        required: REQUIRED_FIELDS,
      },
    },
  };
}

export const EXTRACTION_TOOL = buildExtractionTool(false);
export const EXTRACTION_TOOL_WITH_BBOXES = buildExtractionTool(true);
