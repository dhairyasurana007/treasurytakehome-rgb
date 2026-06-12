import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const output = path.join(process.cwd(), "fixtures", "labels");
await fs.mkdir(output, { recursive: true });

const labels = [
  {
    file: "old-tom-bourbon.png",
    background: "#efe4cb",
    accent: "#7b2d26",
    brand: "OLD TOM DISTILLERY",
    type: "KENTUCKY STRAIGHT BOURBON WHISKEY",
    detail: "45% ALC./VOL. · 750 mL",
    origin: "Bottled by Old Tom Distillery, Louisville, KY · United States",
  },
  {
    file: "red-ridge-wine.png",
    background: "#f5eee6",
    accent: "#6f1d3d",
    brand: "RED RIDGE CELLARS",
    type: "CABERNET SAUVIGNON",
    detail: "13.5% ALC./VOL. · 750 mL",
    origin: "Produced and bottled in Napa, California · United States",
  },
  {
    file: "harbor-lager.png",
    background: "#e5f0f2",
    accent: "#124e66",
    brand: "HARBOR LIGHT",
    type: "AMERICAN LAGER",
    detail: "5% ALC./VOL. · 12 FL. OZ.",
    origin: "Brewed by Harbor Light Brewing, Portland, ME · United States",
  },
];

const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
for (const label of labels) {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: ${label.background}; color: #172033; font-family: Arial, sans-serif; }
      main { width: 800px; height: 1000px; padding: 72px; border: 24px solid ${label.accent}; text-align: center; }
      .eyebrow { letter-spacing: .24em; font-size: 18px; font-weight: 700; }
      h1 { margin: 80px 0 24px; color: ${label.accent}; font-family: Georgia, serif; font-size: 68px; line-height: .95; }
      h2 { margin: 0; font-size: 27px; letter-spacing: .08em; }
      .detail { margin: 48px 0; font-size: 24px; font-weight: 700; }
      .origin { font-size: 18px; line-height: 1.5; }
      .rule { width: 160px; height: 5px; margin: 52px auto; background: ${label.accent}; }
      .warning { margin-top: 80px; border: 3px solid #172033; padding: 24px; font-size: 15px; line-height: 1.45; text-align: left; }
    </style>
    <main>
      <div class="eyebrow">SAMPLE LABEL ARTWORK</div>
      <h1>${label.brand}</h1>
      <h2>${label.type}</h2>
      <div class="rule"></div>
      <p class="detail">${label.detail}</p>
      <p class="origin">${label.origin}</p>
      <p class="warning"><strong>GOVERNMENT WARNING:</strong>${warning.slice("GOVERNMENT WARNING:".length)}</p>
    </main>
  `);
  await page.screenshot({ path: path.join(output, label.file) });
}
await browser.close();
