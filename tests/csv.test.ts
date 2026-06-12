import { describe, expect, it } from "vitest";

import { MAX_CSV_BYTES, parseBatchCsv } from "@/lib/csv";

const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
const headers = [
  "filename",
  "beverage_type",
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler",
  "country",
  "government_warning",
];

function csv(
  rows = [
    [
      "label.png",
      "distilled_spirits",
      "OLD TOM DISTILLERY",
      "Bourbon",
      "45%",
      "750 mL",
      "Old Tom, Louisville KY",
      "United States",
      warning,
    ],
  ],
  customHeaders = headers,
) {
  return Buffer.from(
    [customHeaders, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n"),
  );
}

describe("batch CSV parsing", () => {
  it("parses headers case-insensitively in arbitrary order and ignores unknown columns", () => {
    const customHeaders = [
      " Country ",
      "FILENAME",
      "unknown",
      "government_warning",
      "brand_name",
      "beverage_type",
      "net_contents",
      "bottler",
      "ABV",
      "class_type",
    ];
    const row = [
      "United States",
      "folder/LABEL.PNG",
      "ignored",
      warning,
      "OLD TOM DISTILLERY",
      "distilled_spirits",
      "750 mL",
      "Old Tom",
      "45%",
      "Bourbon",
    ];
    expect(parseBatchCsv(csv([row], customHeaders))[0]).toMatchObject({
      filename: "LABEL.PNG",
      normalizedFilename: "label.png",
      application: { values: { brand_name: "OLD TOM DISTILLERY" } },
    });
  });

  it("supports optional applicability values and blank inapplicable fields", () => {
    const rows = [
      [
        "label.png",
        "wine",
        "Example",
        "Wine",
        "",
        "750 mL",
        "Winery",
        "",
        warning,
        "0",
        "NO",
      ],
    ];
    const parsed = parseBatchCsv(
      csv(rows, [...headers, "abv_applicable", "country_applicable"]),
    );
    expect(parsed[0].application.applicability).toMatchObject({
      abv: false,
      country: false,
    });
  });

  it.each([
    ["empty file", Buffer.from(""), "empty"],
    ["oversized file", new Uint8Array(MAX_CSV_BYTES + 1), "1 MB"],
    ["invalid UTF-8", new Uint8Array([0xff, 0xfe]), "UTF-8"],
    ["binary content", Buffer.from(`${headers.join(",")}\nabc\0def`), "binary"],
    ["malformed quoting", Buffer.from(`${headers.join(",")}\n\"broken`), "structure"],
    ["missing header", csv([], headers.slice(1)), "missing required"],
    ["duplicate normalized header", csv([], [...headers, " ABV "]), "duplicate"],
    [
      "warning applicability",
      csv([], [...headers, "government_warning_applicable"]),
      "cannot be changed",
    ],
  ])("rejects %s", (_name, bytes, message) => {
    expect(() => parseBatchCsv(bytes)).toThrow(message);
  });

  it("rejects 301 rows without truncating", () => {
    const row = [
      "label.png",
      "distilled_spirits",
      "Brand",
      "Bourbon",
      "45%",
      "750 mL",
      "Bottler",
      "USA",
      warning,
    ];
    const rows = Array.from({ length: 301 }, () => [
      ...row.slice(0, 1),
      ...row.slice(1),
    ]);
    rows.forEach((item, index) => {
      item[0] = `label-${index}.png`;
    });
    expect(() => parseBatchCsv(csv(rows))).toThrow("at most 300");
  });

  it("rejects duplicate and case-only filename collisions", () => {
    const base = [
      "distilled_spirits",
      "Brand",
      "Bourbon",
      "45%",
      "750 mL",
      "Bottler",
      "USA",
      warning,
    ];
    expect(() =>
      parseBatchCsv(csv([["Label.PNG", ...base], ["label.png", ...base]])),
    ).toThrow("more than once");
  });

  it("rejects invalid applicability values and overlong text", () => {
    const row = [
      "label.png",
      "wine",
      "Brand",
      "Wine",
      "12%",
      "750 mL",
      "Bottler",
      "USA",
      warning,
      "",
    ];
    expect(() =>
      parseBatchCsv(csv([row], [...headers, "abv_applicable"])),
    ).toThrow("must be true/false");
    row[2] = "x".repeat(2_001);
    row[9] = "true";
    expect(() =>
      parseBatchCsv(csv([row], [...headers, "abv_applicable"])),
    ).toThrow("2,000");
  });
});
