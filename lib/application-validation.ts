import {
  FIELD_NAMES,
  type ApplicationData,
  type ApplicationValues,
  type BeverageType,
  type ConditionalFieldName,
  type FieldApplicability,
} from "@/lib/types";
import { ValidationError } from "@/lib/validation-error";

const BEVERAGE_TYPES = new Set<BeverageType>([
  "beer",
  "wine",
  "distilled_spirits",
]);
const MAX_TEXT_LENGTH = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateApplicationData(input: unknown): ApplicationData {
  if (!isRecord(input)) {
    throw new ValidationError(
      "Application details must be provided.",
      "invalid-application-data",
    );
  }

  if (
    typeof input.beverage_type !== "string" ||
    !BEVERAGE_TYPES.has(input.beverage_type as BeverageType)
  ) {
    throw new ValidationError(
      "Choose beer, wine, or distilled spirits.",
      "invalid-beverage-type",
    );
  }
  if (!isRecord(input.values) || !isRecord(input.applicability)) {
    throw new ValidationError(
      "Application values and field requirements must be provided.",
      "invalid-application-data",
    );
  }
  if (input.applicability.government_warning !== true) {
    throw new ValidationError(
      "The government warning is always required.",
      "government-warning-required",
    );
  }

  const values = {} as ApplicationValues;
  const applicability = { government_warning: true } as FieldApplicability;

  for (const field of FIELD_NAMES) {
    const value = input.values[field];
    if (typeof value !== "string") {
      throw new ValidationError(
        `Enter a valid value for ${field.replaceAll("_", " ")}.`,
        "invalid-field-value",
      );
    }
    if (value.length > MAX_TEXT_LENGTH) {
      throw new ValidationError(
        `${field.replaceAll("_", " ")} must be 2,000 characters or fewer.`,
        "field-too-long",
      );
    }
    values[field] = value;

    if (field === "government_warning") {
      if (!value.trim()) {
        throw new ValidationError(
          "Enter the government warning from the application.",
          "government-warning-required",
        );
      }
      continue;
    }

    const required = input.applicability[field];
    if (typeof required !== "boolean") {
      throw new ValidationError(
        `Specify whether ${field.replaceAll("_", " ")} is required.`,
        "invalid-applicability",
      );
    }
    applicability[field as ConditionalFieldName] = required;
    if (required && !value.trim()) {
      throw new ValidationError(
        `Enter ${field.replaceAll("_", " ")} or mark it not required.`,
        "required-field-empty",
      );
    }
  }

  return {
    beverage_type: input.beverage_type as BeverageType,
    values,
    applicability,
  };
}
