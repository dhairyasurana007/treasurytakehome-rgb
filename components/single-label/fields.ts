import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type {
  ApplicationData,
  ConditionalFieldName,
  FieldName,
} from "@/lib/types";

export const FIELD_CONFIG: Array<{
  key: ConditionalFieldName;
  label: string;
  placeholder: string;
}> = [
  { key: "brand_name", label: "Brand name", placeholder: "e.g. OLD TOM DISTILLERY" },
  {
    key: "class_type",
    label: "Class or type",
    placeholder: "e.g. Kentucky Straight Bourbon Whiskey",
  },
  { key: "abv", label: "Alcohol content", placeholder: "e.g. 45% Alc./Vol." },
  { key: "net_contents", label: "Net contents", placeholder: "e.g. 750 mL" },
  {
    key: "bottler",
    label: "Bottler or producer name and address",
    placeholder: "e.g. Old Tom Distillery, Louisville, KY",
  },
  {
    key: "country",
    label: "Country of origin",
    placeholder: "e.g. United States",
  },
];

export const INITIAL_VALUES: ApplicationData["values"] = {
  brand_name: "",
  class_type: "",
  abv: "",
  net_contents: "",
  bottler: "",
  country: "",
  government_warning: CANONICAL_GOVERNMENT_WARNING,
};

export const INITIAL_APPLICABILITY: ApplicationData["applicability"] = {
  brand_name: true,
  class_type: true,
  abv: true,
  net_contents: true,
  bottler: true,
  country: true,
  government_warning: true,
};

export function fieldLabel(field: FieldName) {
  return (
    FIELD_CONFIG.find((item) => item.key === field)?.label ??
    "Government warning"
  );
}
