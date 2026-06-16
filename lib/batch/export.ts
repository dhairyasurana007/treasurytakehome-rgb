import { FIELD_NAMES } from "@/lib/types";
import type { ApplicationData, ConditionalFieldName, VerificationResult } from "@/lib/types";

const FORMULA_CHARS = /^[=+\-@]/;

export function safeValue(raw: string | null | undefined): string {
  const s = raw ?? "";
  return FORMULA_CHARS.test(s) ? `'${s}` : s;
}

export function csvCell(value: string): string {
  const safe = safeValue(value);
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

export type ExportItem = {
  filename: string;
  application_json: string;
  status: string;
  error: string | null;
  result_json: string | null;
};

export function buildExportCsv(items: ExportItem[]): string {
  const fieldCols = FIELD_NAMES.flatMap((field) => [
    `${field}_applicable`,
    `${field}_verdict`,
    `${field}_submitted`,
    `${field}_extracted`,
  ]);
  const header = csvRow(["filename", "overall_status", "error", ...fieldCols]);

  const dataRows = items.map((item) => {
    const application = item.application_json
      ? (JSON.parse(item.application_json) as ApplicationData)
      : null;
    const result = item.result_json
      ? (JSON.parse(item.result_json) as VerificationResult)
      : null;

    const fieldCells = FIELD_NAMES.flatMap((field) => {
      const applicable =
        field === "government_warning"
          ? true
          : ((application?.applicability[field as ConditionalFieldName]) ?? true);
      const fr = result?.fields[field];
      return [
        String(applicable),
        fr?.verdict ?? "",
        fr?.submitted ?? "",
        fr?.extracted ?? "",
      ];
    });

    const overallStatus =
      item.status === "completed" ? (result?.overall_status ?? "") : item.status;

    return csvRow([
      item.filename,
      overallStatus,
      item.error ?? "",
      ...fieldCells,
    ]);
  });

  return [header, ...dataRows].join("\r\n") + "\r\n";
}

export function isPartialExport(items: Pick<ExportItem, "status">[]): boolean {
  return items.some(
    (item) => item.status === "pending" || item.status === "processing",
  );
}
