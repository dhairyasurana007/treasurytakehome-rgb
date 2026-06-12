import { describe, expect, it } from "vitest";

import {
  CANONICAL_GOVERNMENT_WARNING,
  compareGovernmentWarning,
} from "@/lib/government-warning";

const compliant = {
  extracted: CANONICAL_GOVERNMENT_WARNING,
  submitted: CANONICAL_GOVERNMENT_WARNING,
  prefixBold: true,
  legible: true,
  prominent: true,
};

describe("government warning comparison", () => {
  it("matches only exact canonical text with compliant visual evidence", () => {
    expect(compareGovernmentWarning(compliant).verdict).toBe("match");
  });

  it.each([
    ["matching but noncanonical text", { extracted: "Government Warning: incorrect", submitted: "Government Warning: incorrect" }],
    ["title case prefix", { extracted: CANONICAL_GOVERNMENT_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:") }],
    ["incorrect application text", { submitted: `${CANONICAL_GOVERNMENT_WARNING} ` }],
    ["missing warning", { extracted: null }],
    ["non-bold prefix", { prefixBold: false }],
    ["illegible warning", { legible: false }],
    ["inadequately prominent warning", { prominent: false }],
  ])("returns mismatch for %s", (_name, changes) => {
    expect(compareGovernmentWarning({ ...compliant, ...changes }).verdict).toBe(
      "mismatch",
    );
  });

  it.each([
    ["boldness", { prefixBold: null }],
    ["legibility", { legible: null }],
    ["prominence", { prominent: null }],
  ])("returns needs-review for uncertain %s", (_name, changes) => {
    expect(compareGovernmentWarning({ ...compliant, ...changes }).verdict).toBe(
      "needs-review",
    );
  });
});
