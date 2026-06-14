import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FIXTURE_ITEMS, fixtureResult } from "@/lib/batch-fixtures";
import { BatchStore } from "@/lib/batch-store";
import { BatchWorker } from "@/lib/batch-worker";
import {
  buildExportCsv,
  csvCell,
  csvRow,
  isPartialExport,
  safeValue,
} from "@/lib/export";
import { FIELD_NAMES } from "@/lib/types";

let directory: string;
let store: BatchStore;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
  store = new BatchStore(path.join(directory, "test.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("formula injection prevention", () => {
  it("prefixes = with a single quote", () => {
    expect(safeValue('=HYPERLINK("evil.com")')).toBe('\'=HYPERLINK("evil.com")');
  });

  it("prefixes + with a single quote", () => {
    expect(safeValue("+cmd")).toBe("'+cmd");
  });

  it("prefixes - with a single quote", () => {
    expect(safeValue("-1+2")).toBe("'-1+2");
  });

  it("prefixes @ with a single quote", () => {
    expect(safeValue("@SUM(A1:B1)")).toBe("'@SUM(A1:B1)");
  });

  it("leaves safe values unchanged", () => {
    expect(safeValue("OLD TOM DISTILLERY")).toBe("OLD TOM DISTILLERY");
    expect(safeValue("750 mL")).toBe("750 mL");
    expect(safeValue("45%")).toBe("45%");
  });

  it("treats null and undefined as empty string", () => {
    expect(safeValue(null)).toBe("");
    expect(safeValue(undefined)).toBe("");
  });
});

describe("CSV cell quoting", () => {
  it("quotes values containing commas", () => {
    expect(csvCell("Old Tom, Inc.")).toBe('"Old Tom, Inc."');
  });

  it("quotes and escapes embedded double quotes", () => {
    expect(csvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("quotes values containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles Unicode without corruption", () => {
    expect(csvCell("Château Pétrus")).toBe("Château Pétrus");
    expect(csvCell("日本酒")).toBe("日本酒");
  });

  it("leaves plain values unquoted", () => {
    expect(csvCell("United States")).toBe("United States");
  });
});

describe("CSV row", () => {
  it("joins cells with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("applies formula escaping per cell", () => {
    expect(csvRow(["=bad", "safe", "+also-bad"])).toBe("'=bad,safe,'+also-bad");
  });
});

describe("buildExportCsv", () => {
  it("produces 31 columns in the header (3 base + 7 fields × 4)", () => {
    const csv = buildExportCsv([]);
    const header = csv.split("\r\n")[0];
    expect(header.split(",")).toHaveLength(31);
  });

  it("includes all required base headers", () => {
    const csv = buildExportCsv([]);
    const header = csv.split("\r\n")[0];
    expect(header).toContain("filename");
    expect(header).toContain("overall_status");
    expect(header).toContain("error");
  });

  it("includes per-field columns for all seven fields", () => {
    const csv = buildExportCsv([]);
    const header = csv.split("\r\n")[0];
    for (const field of FIELD_NAMES) {
      expect(header).toContain(`${field}_applicable`);
      expect(header).toContain(`${field}_verdict`);
      expect(header).toContain(`${field}_submitted`);
      expect(header).toContain(`${field}_extracted`);
    }
  });

  it("preserves original position order after parallel processing", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => fixtureResult(item), 2);
    await worker.runUntilIdle();

    const items = store.getJobExportItems(jobId);
    const csv = buildExportCsv(items);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toContain("label-a.png");
    expect(lines[2]).toContain("label-b.png");
  });

  it("uses CRLF line endings", () => {
    const csv = buildExportCsv([]);
    expect(csv).toContain("\r\n");
  });

  it("ends with a trailing CRLF", () => {
    const csv = buildExportCsv([]);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("shows overall_status from result on completed items", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => fixtureResult(item), 2);
    await worker.runUntilIdle();

    const items = store.getJobExportItems(jobId);
    const csv = buildExportCsv(items);
    const lines = csv.trimEnd().split("\r\n");
    const cells = lines[1].split(",");
    expect(cells[1]).toBe("match");
  });

  it("shows item status as overall_status for non-completed items", () => {
    const pendingItem = {
      filename: "pending.png",
      application_json: JSON.stringify(FIXTURE_ITEMS[0].application),
      status: "pending",
      error: null,
      result_json: null,
    };
    const csv = buildExportCsv([pendingItem]);
    const cells = csv.split("\r\n")[1].split(",");
    expect(cells[1]).toBe("pending");
  });

  it("includes error message for errored items", () => {
    const errorItem = {
      filename: "bad.png",
      application_json: JSON.stringify(FIXTURE_ITEMS[0].application),
      status: "error",
      error: "Provider timeout",
      result_json: null,
    };
    const csv = buildExportCsv([errorItem]);
    expect(csv).toContain("Provider timeout");
    expect(csv).toContain("error");
  });

  it("sets government_warning_applicable to true regardless of application data", () => {
    const item = {
      filename: "test.png",
      application_json: JSON.stringify(FIXTURE_ITEMS[0].application),
      status: "pending",
      error: null,
      result_json: null,
    };
    const csv = buildExportCsv([item]);
    const header = csv.split("\r\n")[0].split(",");
    const gwIdx = header.indexOf("government_warning_applicable");
    expect(gwIdx).toBeGreaterThan(-1);
    const dataRow = csv.split("\r\n")[1].split(",");
    expect(dataRow[gwIdx]).toBe("true");
  });

  it("escapes formula characters in submitted values", () => {
    const item = {
      filename: "test.png",
      application_json: JSON.stringify({
        ...FIXTURE_ITEMS[0].application,
        values: { ...FIXTURE_ITEMS[0].application.values, brand_name: "=EVIL()" },
      }),
      status: "completed",
      error: null,
      result_json: JSON.stringify({
        overall_status: "mismatch",
        fields: {
          brand_name: { field: "brand_name", verdict: "mismatch", submitted: "=EVIL()", extracted: "SAFE BRAND", reason: "" },
          class_type: { field: "class_type", verdict: "match", submitted: "x", extracted: "x", reason: "" },
          abv: { field: "abv", verdict: "match", submitted: "45%", extracted: "45%", reason: "" },
          net_contents: { field: "net_contents", verdict: "match", submitted: "750 mL", extracted: "750 mL", reason: "" },
          bottler: { field: "bottler", verdict: "match", submitted: "x", extracted: "x", reason: "" },
          country: { field: "country", verdict: "match", submitted: "x", extracted: "x", reason: "" },
          government_warning: { field: "government_warning", verdict: "match", submitted: "x", extracted: "x", reason: "" },
        },
      }),
    };
    const csv = buildExportCsv([item]);
    expect(csv).toContain("'=EVIL()");
    expect(csv).not.toMatch(/(?<!')=EVIL\(\)/);
  });
});

describe("isPartialExport", () => {
  it("returns true when any item is pending", () => {
    expect(isPartialExport([{ status: "completed" }, { status: "pending" }])).toBe(true);
  });

  it("returns true when any item is processing", () => {
    expect(isPartialExport([{ status: "processing" }])).toBe(true);
  });

  it("returns false when all items are completed or errored", () => {
    expect(isPartialExport([{ status: "completed" }, { status: "error" }])).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(isPartialExport([])).toBe(false);
  });
});

describe("getJobExportItems", () => {
  it("returns items ordered by position", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => fixtureResult(item), 2);
    await worker.runUntilIdle();

    const items = store.getJobExportItems(jobId);
    expect(items.map((i) => i.filename)).toEqual(["label-a.png", "label-b.png"]);
    expect(items.map((i) => i.position)).toEqual([0, 1]);
  });

  it("includes result_json for completed items", async () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const worker = new BatchWorker(store, async (item) => fixtureResult(item), 2);
    await worker.runUntilIdle();

    const items = store.getJobExportItems(jobId);
    expect(items.every((i) => i.result_json !== null)).toBe(true);
  });

  it("returns null result_json for pending items", () => {
    const jobId = store.createJob(FIXTURE_ITEMS);
    const items = store.getJobExportItems(jobId);
    expect(items.every((i) => i.result_json === null)).toBe(true);
  });
});
