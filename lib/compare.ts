import { compareGovernmentWarning } from "@/lib/government-warning";
import {
  FIELD_NAMES,
  type ApplicationData,
  type ConditionalFieldName,
  type ExtractedFields,
  type FieldName,
  type FieldResult,
  type FieldVerdict,
  type OverallStatus,
  type VerificationResult,
} from "@/lib/types";

const COUNTRY_ALIASES = [
  new Set(["usa", "us", "united states", "united states of america"]),
  new Set(["uk", "united kingdom", "great britain"]),
];

function result(
  field: FieldName,
  verdict: FieldVerdict,
  submitted: string,
  extracted: string | null,
  reason: string,
): FieldResult {
  return { field, verdict, submitted, extracted, reason };
}

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalWords(value: string) {
  return compact(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wordSet(value: string) {
  return new Set(canonicalWords(value).split(" ").filter(Boolean));
}

function overlapRatio(left: string, right: string) {
  const leftWords = wordSet(left);
  const rightWords = wordSet(right);
  if (!leftWords.size || !rightWords.size) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.max(leftWords.size, rightWords.size);
}

function compareBrand(submitted: string, extracted: string | null): FieldResult {
  if (!extracted) {
    return result("brand_name", "mismatch", submitted, extracted, "Brand name was not found.");
  }
  if (extracted === submitted) {
    return result("brand_name", "match", submitted, extracted, "Brand names match exactly.");
  }
  if (
    canonicalWords(extracted) === canonicalWords(submitted) ||
    overlapRatio(extracted, submitted) >= 2 / 3
  ) {
    return result(
      "brand_name",
      "needs-review",
      submitted,
      extracted,
      "The brand names appear equivalent, but a person should confirm the difference.",
    );
  }
  return result("brand_name", "mismatch", submitted, extracted, "Brand names are different.");
}

function parseAbv(value: string): number | null {
  const normalized = value.toLocaleLowerCase("en-US");
  const number = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!number) return null;
  const parsed = Number(number[1]);
  if (!Number.isFinite(parsed)) return null;
  return normalized.includes("proof") && !normalized.includes("%") ? parsed / 2 : parsed;
}

function compareAbv(submitted: string, extracted: string | null): FieldResult {
  const submittedAbv = parseAbv(submitted);
  const extractedAbv = extracted ? parseAbv(extracted) : null;
  if (submittedAbv === null || extractedAbv === null) {
    return result("abv", "mismatch", submitted, extracted, "Alcohol content could not be compared.");
  }
  const verdict = Math.abs(submittedAbv - extractedAbv) <= 0.1 ? "match" : "mismatch";
  return result(
    "abv",
    verdict,
    submitted,
    extracted,
    verdict === "match" ? "Alcohol content matches." : "Alcohol content is different.",
  );
}

function parseVolume(value: string): number | null {
  const match = value
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, "")
    .match(/(\d+(?:\.\d+)?)(ml|milliliters?|l|liters?|cl|oz|floz)/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "l" || unit.startsWith("liter")) return amount * 1000;
  if (unit === "cl") return amount * 10;
  if (unit === "oz" || unit === "floz") return amount * 29.5735;
  return amount;
}

function compareNetContents(
  submitted: string,
  extracted: string | null,
): FieldResult {
  const submittedMl = parseVolume(submitted);
  const extractedMl = extracted ? parseVolume(extracted) : null;
  if (submittedMl === null || extractedMl === null) {
    return result(
      "net_contents",
      "mismatch",
      submitted,
      extracted,
      "Net contents could not be compared.",
    );
  }
  const verdict = Math.abs(submittedMl - extractedMl) < 0.5 ? "match" : "mismatch";
  return result(
    "net_contents",
    verdict,
    submitted,
    extracted,
    verdict === "match" ? "Net contents match." : "Net contents are different.",
  );
}

function compareText(
  field: "class_type" | "bottler",
  submitted: string,
  extracted: string | null,
): FieldResult {
  if (!extracted) {
    return result(field, "mismatch", submitted, extracted, "Required text was not found.");
  }
  if (compact(extracted).toLocaleLowerCase("en-US") === compact(submitted).toLocaleLowerCase("en-US")) {
    return result(field, "match", submitted, extracted, "Values match.");
  }
  if (
    canonicalWords(extracted) === canonicalWords(submitted) ||
    overlapRatio(extracted, submitted) >= 2 / 3
  ) {
    return result(
      field,
      "needs-review",
      submitted,
      extracted,
      "The values are similar, but a person should confirm the difference.",
    );
  }
  return result(field, "mismatch", submitted, extracted, "Values are different.");
}

function compareCountry(submitted: string, extracted: string | null): FieldResult {
  if (!extracted) {
    return result("country", "mismatch", submitted, extracted, "Country of origin was not found.");
  }
  const left = canonicalWords(submitted);
  const right = canonicalWords(extracted);
  if (left === right) {
    return result("country", "match", submitted, extracted, "Countries match.");
  }
  if (COUNTRY_ALIASES.some((aliases) => aliases.has(left) && aliases.has(right))) {
    return result(
      "country",
      "needs-review",
      submitted,
      extracted,
      "The country names use a common abbreviation or alternate form.",
    );
  }
  return result("country", "mismatch", submitted, extracted, "Countries are different.");
}

function compareConditionalField(
  field: ConditionalFieldName,
  application: ApplicationData,
  extracted: ExtractedFields,
): FieldResult {
  const submitted = application.values[field];
  const extractedValue = extracted[field];
  if (!application.applicability[field]) {
    return result(
      field,
      "not-applicable",
      submitted,
      extractedValue,
      "This field is not required on the submitted application.",
    );
  }

  switch (field) {
    case "brand_name":
      return compareBrand(submitted, extractedValue);
    case "abv":
      return compareAbv(submitted, extractedValue);
    case "net_contents":
      return compareNetContents(submitted, extractedValue);
    case "class_type":
    case "bottler":
      return compareText(field, submitted, extractedValue);
    case "country":
      return compareCountry(submitted, extractedValue);
  }
}

export function getOverallStatus(
  fields: Record<FieldName, FieldResult>,
): OverallStatus {
  const verdicts = FIELD_NAMES.map((field) => fields[field].verdict);
  if (verdicts.includes("mismatch")) return "mismatch";
  if (verdicts.includes("needs-review")) return "needs-review";
  return "match";
}

export function compareFields(
  extracted: ExtractedFields,
  application: ApplicationData,
): VerificationResult {
  const conditionalFields = FIELD_NAMES.filter(
    (field): field is ConditionalFieldName => field !== "government_warning",
  );
  const conditionalResults = Object.fromEntries(
    conditionalFields.map((field) => [
      field,
      compareConditionalField(field, application, extracted),
    ]),
  ) as Record<ConditionalFieldName, FieldResult>;

  const fields: Record<FieldName, FieldResult> = {
    ...conditionalResults,
    government_warning: compareGovernmentWarning({
      extracted: extracted.government_warning,
      submitted: application.values.government_warning,
      prefixBold: extracted.government_warning_prefix_bold,
      legible: extracted.government_warning_legible,
      prominent: extracted.government_warning_prominent,
    }),
  };

  return { fields, overall_status: getOverallStatus(fields) };
}
