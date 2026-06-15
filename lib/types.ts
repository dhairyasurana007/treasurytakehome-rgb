export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Bboxes = Partial<Record<FieldName, Bbox | null>>;

export const FIELD_NAMES = [
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler",
  "country",
  "government_warning",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];
export type ConditionalFieldName = Exclude<FieldName, "government_warning">;
export type BeverageType = "beer" | "wine" | "distilled_spirits";
export type FieldVerdict =
  | "match"
  | "needs-review"
  | "mismatch"
  | "not-applicable";
export type OverallStatus = Exclude<FieldVerdict, "not-applicable">;

export type ApplicationValues = Record<FieldName, string>;
export type FieldApplicability = Record<ConditionalFieldName, boolean> & {
  government_warning: true;
};

export interface ApplicationData {
  beverage_type: BeverageType;
  values: ApplicationValues;
  applicability: FieldApplicability;
}

export interface ExtractedFields {
  brand_name: string | null;
  class_type: string | null;
  abv: string | null;
  net_contents: string | null;
  bottler: string | null;
  country: string | null;
  government_warning: string | null;
  government_warning_prefix_bold: boolean | null;
  government_warning_legible: boolean | null;
  government_warning_prominent: boolean | null;
  bboxes?: Bboxes | null;
}

export interface FieldResult {
  field: FieldName;
  verdict: FieldVerdict;
  submitted: string;
  extracted: string | null;
  reason: string;
}

export interface VerificationResult {
  fields: Record<FieldName, FieldResult>;
  overall_status: OverallStatus;
  bboxes?: Bboxes | null;
}
