import fs from "node:fs/promises";
import path from "node:path";

const target =
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://ttb-label-verifier-rgb.onrender.com";
const iterations = Number(process.env.LATENCY_ITERATIONS ?? 20);
const image = await fs.readFile(
  path.join(process.cwd(), "fixtures", "labels", "old-tom-bourbon.png"),
);
const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
const application = {
  beverage_type: "distilled_spirits",
  values: {
    brand_name: "OLD TOM DISTILLERY",
    class_type: "KENTUCKY STRAIGHT BOURBON WHISKEY",
    abv: "45% ALC./VOL.",
    net_contents: "750 mL",
    bottler: "Old Tom Distillery, Louisville, KY",
    country: "United States",
    government_warning: warning,
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

const timings = [];
for (let index = 0; index < iterations; index += 1) {
  const form = new FormData();
  form.set("image", new File([image], "old-tom-bourbon.png", { type: "image/png" }));
  form.set("applicationData", JSON.stringify(application));
  const started = performance.now();
  const response = await fetch(`${target}/api/verify`, {
    method: "POST",
    body: form,
  });
  timings.push(performance.now() - started);
  if (!response.ok) {
    throw new Error(`Latency request ${index + 1} failed with ${response.status}.`);
  }
}
timings.sort((left, right) => left - right);
const percentile = (value) =>
  timings[Math.min(timings.length - 1, Math.ceil(value * timings.length) - 1)];
console.log(
  JSON.stringify(
    {
      target,
      iterations,
      p50Ms: Math.round(percentile(0.5)),
      p95Ms: Math.round(percentile(0.95)),
      maxMs: Math.round(timings.at(-1)),
    },
    null,
    2,
  ),
);
if (percentile(0.95) > 5_000) process.exitCode = 1;
