import type { FieldResult } from "@/lib/types";

export const CANONICAL_GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

interface WarningEvidence {
  extracted: string | null;
  submitted: string;
  prefixBold: boolean | null;
  legible: boolean | null;
  prominent: boolean | null;
}

export function compareGovernmentWarning({
  extracted,
  submitted,
  prefixBold,
  legible,
  prominent,
}: WarningEvidence): FieldResult {
  const base = {
    field: "government_warning" as const,
    extracted,
    submitted,
  };

  if (
    extracted !== CANONICAL_GOVERNMENT_WARNING ||
    submitted !== CANONICAL_GOVERNMENT_WARNING
  ) {
    return {
      ...base,
      verdict: "mismatch",
      reason: "The label and application must both use the exact required warning.",
    };
  }

  if (prefixBold === false || legible === false || prominent === false) {
    return {
      ...base,
      verdict: "mismatch",
      reason:
        "The warning text is correct, but its bold prefix, legibility, or prominence is not compliant.",
    };
  }

  if (prefixBold === null || legible === null || prominent === null) {
    return {
      ...base,
      verdict: "needs-review",
      reason:
        "The warning text is correct, but its visual presentation needs human review.",
    };
  }

  return {
    ...base,
    verdict: "match",
    reason: "The warning text and visual presentation meet the required checks.",
  };
}
