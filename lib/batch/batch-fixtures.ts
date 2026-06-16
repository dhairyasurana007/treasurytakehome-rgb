import { compareFields } from "@/lib/compare";
import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type { NewBatchItem } from "@/lib/batch/batch-types";
import type { ExtractedFields } from "@/lib/types";

export const FIXTURE_ITEMS: NewBatchItem[] = ["label-a.png", "label-b.png"].map(
  (filename) => ({
    filename,
    imagePath: `/fixture/${filename}`,
    application: {
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
    },
  }),
);

const extracted: ExtractedFields = {
  ...FIXTURE_ITEMS[0].application.values,
  government_warning_prefix_bold: true,
  government_warning_legible: true,
  government_warning_prominent: true,
};

export function fixtureResult(item: NewBatchItem) {
  return compareFields(extracted, item.application);
}
