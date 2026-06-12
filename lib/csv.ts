import path from "node:path";

import { parse } from "csv-parse/sync";

import type { ApplicationData, ConditionalFieldName } from "@/lib/types";
import { ValidationError } from "@/lib/validation-error";

export const MAX_CSV_BYTES = 1024 * 1024;
export const MAX_BATCH_ROWS = 300;
export const MAX_TEXT_LENGTH = 2_000;
export const MAX_BASENAME_LENGTH = 255;

const REQUIRED_HEADERS = [
  "filename",
  "beverage_type",
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler",
  "country",
  "government_warning",
] as const;
const CONDITIONAL_FIELDS: ConditionalFieldName[] = [
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler",
  "country",
];

export interface BatchManifestRow {
  filename: string;
  normalizedFilename: string;
  application: ApplicationData;
}

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function normalizeBasename(value: string) {
  const basename = path.win32.basename(value.trim()).split("/").pop() ?? "";
  return basename.toLocaleLowerCase("en-US");
}

function parseBoolean(value: string, header: string) {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new ValidationError(
    `${header} must be true/false, yes/no, or 1/0.`,
    "invalid-applicability",
  );
}

export function parseBatchCsv(bytes: Uint8Array): BatchManifestRow[] {
  if (bytes.length === 0) {
    throw new ValidationError("The CSV file is empty.", "empty-csv");
  }
  if (bytes.length > MAX_CSV_BYTES) {
    throw new ValidationError("The CSV file must be 1 MB or smaller.", "csv-too-large");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ValidationError("The CSV file must use UTF-8 text.", "invalid-utf8");
  }
  if (text.includes("\0")) {
    throw new ValidationError("The CSV file contains binary data.", "binary-csv");
  }

  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      columns: false,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: false,
    }) as string[][];
  } catch {
    throw new ValidationError(
      "The CSV structure or quoting is invalid.",
      "malformed-csv",
    );
  }
  if (records.length === 0) {
    throw new ValidationError(
      "The CSV must contain a header and at least one data row.",
      "empty-csv",
    );
  }

  const headers = records[0].map(normalizeHeader);
  const duplicates = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicates.length) {
    throw new ValidationError(
      `The CSV contains duplicate headers: ${[...new Set(duplicates)].join(", ")}.`,
      "duplicate-header",
    );
  }
  if (headers.includes("government_warning_applicable")) {
    throw new ValidationError(
      "Government warning applicability cannot be changed.",
      "government-warning-applicability",
    );
  }
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new ValidationError(
      `The CSV is missing required columns: ${missing.join(", ")}.`,
      "missing-header",
    );
  }

  const rows = records.slice(1);
  if (rows.length === 0) {
    throw new ValidationError(
      "The CSV must contain a header and at least one data row.",
      "empty-csv",
    );
  }
  if (rows.length > MAX_BATCH_ROWS) {
    throw new ValidationError(
      "A batch can contain at most 300 labels.",
      "too-many-rows",
    );
  }

  const seen = new Set<string>();
  return rows.map((record, rowIndex) => {
    if (record.length !== headers.length) {
      throw new ValidationError(
        `CSV row ${rowIndex + 2} has the wrong number of columns.`,
        "malformed-csv",
      );
    }
    const values = Object.fromEntries(
      headers.map((header, index) => [header, record[index]]),
    );
    const filename = path.win32.basename(values.filename.trim()).split("/").pop() ?? "";
    const normalizedFilename = normalizeBasename(filename);
    if (!filename || filename.length > MAX_BASENAME_LENGTH) {
      throw new ValidationError(
        `CSV row ${rowIndex + 2} has an invalid filename.`,
        "invalid-filename",
      );
    }
    if (seen.has(normalizedFilename)) {
      throw new ValidationError(
        `The filename ${filename} appears more than once.`,
        "duplicate-filename",
      );
    }
    seen.add(normalizedFilename);

    const applicability = {
      government_warning: true as const,
    } as ApplicationData["applicability"];
    for (const field of CONDITIONAL_FIELDS) {
      const header = `${field}_applicable`;
      applicability[field] =
        values[header] === undefined ? true : parseBoolean(values[header], header);
    }

    const applicationValues: ApplicationData["values"] = {
      brand_name: values.brand_name,
      class_type: values.class_type,
      abv: values.abv,
      net_contents: values.net_contents,
      bottler: values.bottler,
      country: values.country,
      government_warning: values.government_warning,
    };
    for (const [field, value] of Object.entries(applicationValues)) {
      if (value.length > MAX_TEXT_LENGTH) {
        throw new ValidationError(
          `${field} on row ${rowIndex + 2} must be 2,000 characters or fewer.`,
          "field-too-long",
        );
      }
      if (
        field !== "government_warning" &&
        applicability[field as ConditionalFieldName] &&
        !value.trim()
      ) {
        throw new ValidationError(
          `${field} is required on row ${rowIndex + 2}.`,
          "required-field-empty",
        );
      }
    }
    if (!applicationValues.government_warning.trim()) {
      throw new ValidationError(
        `government_warning is required on row ${rowIndex + 2}.`,
        "government-warning-required",
      );
    }

    if (!["beer", "wine", "distilled_spirits"].includes(values.beverage_type)) {
      throw new ValidationError(
        `beverage_type is invalid on row ${rowIndex + 2}.`,
        "invalid-beverage-type",
      );
    }

    return {
      filename,
      normalizedFilename,
      application: {
        beverage_type: values.beverage_type as ApplicationData["beverage_type"],
        values: applicationValues,
        applicability,
      },
    };
  });
}
