import { describe, expect, it } from "vitest";

import { compareFields } from "@/lib/compare";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type { ApplicationData, ExtractedFields } from "@/lib/types";

const application: ApplicationData = {
  beverage_type: "distilled_spirits",
  values: {
    brand_name: "OLD TOM DISTILLERY",
    class_type: "Kentucky Straight Bourbon Whiskey",
    abv: "45%",
    net_contents: "750 mL",
    bottler: "Old Tom Distillery, Louisville, KY",
    country: "United States",
    government_warning: CANONICAL_GOVERNMENT_WARNING,
  },
  applicability: {
    brand_name: true,
    class_type: true,
    abv: true,
    net_contents: true,
    bottler: true,
    country: true,
    government_warning: true,
  },
};

const extracted: ExtractedFields = {
  ...application.values,
  government_warning_prefix_bold: true,
  government_warning_legible: true,
  government_warning_prominent: true,
};

describe("field comparison", () => {
  it("matches exact values", () => {
    const result = compareFields(extracted, application);
    expect(result.overall_status).toBe("match");
    expect(Object.values(result.fields).every((field) => field.verdict === "match")).toBe(true);
  });

  it("treats case-only brand differences as a match", () => {
    const result = compareFields(
      { ...extracted, brand_name: "old tom distillery" },
      application,
    );
    expect(result.fields.brand_name.verdict).toBe("match");
    expect(result.overall_status).toBe("match");
  });

  it("flags punctuation-only brand differences for review", () => {
    const result = compareFields(
      { ...extracted, brand_name: "OLD TOM DISTILLERY." },
      application,
    );
    expect(result.fields.brand_name.verdict).toBe("needs-review");
    expect(result.overall_status).toBe("needs-review");
  });

  it("mismatches clearly different brands", () => {
    expect(
      compareFields(
        { ...extracted, brand_name: "New Tom" },
        { ...application, values: { ...application.values, brand_name: "Old Tom" } },
      ).fields.brand_name.verdict,
    ).toBe("mismatch");
  });

  it.each([
    ["45% Alc./Vol.", "45%"],
    ["90 Proof", "45%"],
  ])("matches equivalent ABV values: %s and %s", (label, submitted) => {
    const result = compareFields(
      { ...extracted, abv: label },
      { ...application, values: { ...application.values, abv: submitted } },
    );
    expect(result.fields.abv.verdict).toBe("match");
  });

  it("mismatches different ABV values", () => {
    expect(
      compareFields({ ...extracted, abv: "46%" }, application).fields.abv.verdict,
    ).toBe("mismatch");
  });

  it("normalizes net-content units", () => {
    expect(
      compareFields(
        { ...extracted, net_contents: "0.75 L" },
        application,
      ).fields.net_contents.verdict,
    ).toBe("match");
  });

  it("marks common country abbreviations for review", () => {
    expect(
      compareFields({ ...extracted, country: "USA" }, application).fields.country
        .verdict,
    ).toBe("needs-review");
  });

  it("short-circuits conditional fields marked inapplicable", () => {
    const result = compareFields(
      { ...extracted, country: null, abv: null },
      {
        ...application,
        applicability: {
          ...application.applicability,
          country: false,
          abv: false,
        },
      },
    );
    expect(result.fields.country.verdict).toBe("not-applicable");
    expect(result.fields.abv.verdict).toBe("not-applicable");
    expect(result.overall_status).toBe("match");
  });

  it("uses mismatch as the worst applicable overall result", () => {
    const result = compareFields(
      { ...extracted, brand_name: "OLD TOM", abv: "46%" },
      application,
    );
    expect(result.fields.brand_name.verdict).toBe("needs-review");
    expect(result.fields.abv.verdict).toBe("mismatch");
    expect(result.overall_status).toBe("mismatch");
  });

  it("mismatches all missing applicable extracted values", () => {
    const result = compareFields(
      {
        brand_name: null,
        class_type: null,
        abv: null,
        net_contents: null,
        bottler: null,
        country: null,
        government_warning: null,
        government_warning_prefix_bold: null,
        government_warning_legible: null,
        government_warning_prominent: null,
      },
      application,
    );
    expect(Object.values(result.fields).every((field) => field.verdict === "mismatch")).toBe(true);
  });
});
