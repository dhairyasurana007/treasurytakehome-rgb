import { notFound } from "next/navigation";

import { compareFields } from "@/lib/compare";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type { ApplicationData, ExtractedFields } from "@/lib/types";

export const dynamic = "force-dynamic";

const application: ApplicationData = {
  beverage_type: "distilled_spirits",
  values: {
    brand_name: "Stone's Throw",
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
    country: false,
    government_warning: true,
  },
};

const extracted: ExtractedFields = {
  brand_name: "STONE'S THROW",
  class_type: "Kentucky Straight Bourbon Whiskey",
  abv: "46%",
  net_contents: "750ml",
  bottler: "Old Tom Distillery, Louisville, KY",
  country: null,
  government_warning: CANONICAL_GOVERNMENT_WARNING,
  government_warning_prefix_bold: true,
  government_warning_legible: true,
  government_warning_prominent: true,
};

export default function ComparisonHarness() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  const verification = compareFields(extracted, application);

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Comparison verdict harness</h1>
      <p>Deterministic examples for browser verification.</p>
      <div className="verdict-grid">
        {Object.values(verification.fields).map((field) => (
          <article
            className={`verdict-card verdict-${field.verdict}`}
            data-testid={`verdict-${field.verdict}`}
            key={field.field}
          >
            <strong>{field.field.replaceAll("_", " ")}</strong>
            <span>{field.verdict}</span>
            <p>{field.reason}</p>
            <small>
              Extracted: {field.extracted ?? "Not found"} | Submitted:{" "}
              {field.submitted || "Not provided"}
            </small>
          </article>
        ))}
      </div>
    </main>
  );
}
