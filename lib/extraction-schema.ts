import { z } from "zod";

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
});

export const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "record_label_fields",
    description:
      "Record alcohol label fields exactly as visibly printed on the supplied artwork.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
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
      },
      required: [
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
      ],
    },
  },
};
