import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/verify/route";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const originalMode = process.env.EXTRACTION_MODE;
const originalHarness = process.env.ENABLE_TEST_HARNESS;

const application = {
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

function request(scenario = "success") {
  const form = new FormData();
  form.set("image", new File([PNG_1X1], "label.png", { type: "text/plain" }));
  form.set("applicationData", JSON.stringify(application));
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "x-test-provider-scenario": scenario },
    body: form,
  });
}

afterEach(() => {
  process.env.EXTRACTION_MODE = originalMode;
  process.env.ENABLE_TEST_HARNESS = originalHarness;
});

describe("verification route", () => {
  it("validates, extracts, and compares a label", async () => {
    process.env.EXTRACTION_MODE = "mock";
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      overall_status: "match",
    });
  });

  it("returns a generic provider error", async () => {
    process.env.EXTRACTION_MODE = "mock";
    process.env.ENABLE_TEST_HARNESS = "true";
    const response = await POST(request("error"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The label could not be analyzed. Please try again.",
    });
  });
});
