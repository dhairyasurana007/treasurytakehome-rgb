import { describe, expect, it } from "vitest";

import { validateApplicationData } from "@/lib/application-validation";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";

const valid = {
  beverage_type: "wine",
  values: {
    brand_name: "Example",
    class_type: "Red wine",
    abv: "13%",
    net_contents: "750 mL",
    bottler: "Example Winery",
    country: "",
    government_warning: CANONICAL_GOVERNMENT_WARNING,
  },
  applicability: {
    brand_name: true,
    class_type: true,
    abv: true,
    net_contents: true,
    bottler: true,
    country: false,
    government_warning: true,
  },
};

describe("application validation", () => {
  it("accepts valid application data with an inapplicable blank field", () => {
    expect(validateApplicationData(valid)).toMatchObject(valid);
  });

  it("rejects an attempt to disable the government warning", () => {
    expect(() =>
      validateApplicationData({
        ...valid,
        applicability: { ...valid.applicability, government_warning: false },
      }),
    ).toThrow("always required");
  });

  it("rejects a blank applicable field", () => {
    expect(() =>
      validateApplicationData({
        ...valid,
        values: { ...valid.values, abv: "" },
      }),
    ).toThrow("Enter abv");
  });

  it("rejects malformed beverage and applicability values", () => {
    expect(() =>
      validateApplicationData({ ...valid, beverage_type: "water" }),
    ).toThrow("Choose beer, wine, or distilled spirits");
    expect(() =>
      validateApplicationData({
        ...valid,
        applicability: { ...valid.applicability, country: "no" },
      }),
    ).toThrow("Specify whether country is required");
  });
});
