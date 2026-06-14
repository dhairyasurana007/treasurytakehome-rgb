/**
 * Fixture label upload tests.
 * Uploads each real label image from fixtures/labels/ via the single-label
 * workflow and asserts the verification completes without errors.
 * Run against production:
 *   PLAYWRIGHT_BASE_URL=https://ttb-label-verifier.onrender.com npx playwright test e2e/fixtures-label-upload.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";
import path from "path";

// Wake Render before any tests run — prevents cold-start timeouts mid-suite.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/", { timeout: 90_000, waitUntil: "networkidle" });
  await page.close();
});

const GOV_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "labels");

interface Fixture {
  file: string;
  beverageType: "distilled_spirits" | "wine" | "beer";
  brandName: string;
  classType: string;
  abv: string;
  netContents: string;
  bottler: string;
  country: string;
}

const FIXTURES: Fixture[] = [
  // ── Spirits ───────────────────────────────────────────────
  {
    file: "buffalo-trace-bourbon.png",
    beverageType: "distilled_spirits",
    brandName: "Buffalo Trace",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Buffalo Trace Distillery, Frankfort, KY 40601",
    country: "United States",
  },
  {
    file: "buffalo-trace-bourbon-cream.png",
    beverageType: "distilled_spirits",
    brandName: "Buffalo Trace Bourbon Cream",
    classType: "Cream Liqueur",
    abv: "15% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Buffalo Trace Distillery, Frankfort, KY 40601",
    country: "United States",
  },
  {
    file: "buffalo-trace-kosher-rye.png",
    beverageType: "distilled_spirits",
    brandName: "Buffalo Trace Kosher Whiskey",
    classType: "Straight Rye Whiskey",
    abv: "45% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Buffalo Trace Distillery, Frankfort, KY 40601",
    country: "United States",
  },
  {
    file: "traveller-whiskey.png",
    beverageType: "distilled_spirits",
    brandName: "Traveller Whiskey",
    classType: "Blended Whiskey",
    abv: "40% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Buffalo Trace Distillery, Frankfort, KY 40601",
    country: "United States",
  },
  {
    file: "wild-turkey-bourbon.webp",
    beverageType: "distilled_spirits",
    brandName: "Wild Turkey",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "40.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Wild Turkey Distilling Co., Lawrenceburg, KY 40342",
    country: "United States",
  },
  {
    file: "wild-turkey-101-rye.png",
    beverageType: "distilled_spirits",
    brandName: "Wild Turkey 101 Rye",
    classType: "Kentucky Straight Rye Whiskey",
    abv: "50.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Wild Turkey Distilling Co., Lawrenceburg, KY 40342",
    country: "United States",
  },
  {
    file: "wild-turkey-rare-breed.webp",
    beverageType: "distilled_spirits",
    brandName: "Wild Turkey Rare Breed",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "58.4% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Wild Turkey Distilling Co., Lawrenceburg, KY 40342",
    country: "United States",
  },
  // ── Wine ──────────────────────────────────────────────────
  {
    file: "la-crema-pinot-noir.png",
    beverageType: "wine",
    brandName: "La Crema",
    classType: "Pinot Noir",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "La Crema Winery, Santa Rosa, CA 95403",
    country: "United States",
  },
  {
    file: "la-crema-chardonnay.png",
    beverageType: "wine",
    brandName: "La Crema",
    classType: "Chardonnay",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "La Crema Winery, Santa Rosa, CA 95403",
    country: "United States",
  },
  {
    file: "la-crema-cabernet.png",
    beverageType: "wine",
    brandName: "La Crema",
    classType: "Cabernet Sauvignon",
    abv: "13.8% Alc./Vol.",
    netContents: "750 mL",
    bottler: "La Crema Winery, Santa Rosa, CA 95403",
    country: "United States",
  },
  {
    file: "la-crema-sparkling-rose.png",
    beverageType: "wine",
    brandName: "La Crema",
    classType: "Sparkling Rosé",
    abv: "12% Alc./Vol.",
    netContents: "750 mL",
    bottler: "La Crema Winery, Santa Rosa, CA 95403",
    country: "United States",
  },
  {
    file: "sonoma-cutrer-pinot-noir-les-plus-haut.png",
    beverageType: "wine",
    brandName: "Sonoma-Cutrer",
    classType: "Pinot Noir",
    abv: "14% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Sonoma-Cutrer Vineyards, Windsor, CA 95492",
    country: "United States",
  },
  {
    file: "sonoma-cutrer-vine-hill-pinot-noir.png",
    beverageType: "wine",
    brandName: "Sonoma-Cutrer",
    classType: "Pinot Noir",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Sonoma-Cutrer Vineyards, Windsor, CA 95492",
    country: "United States",
  },
  {
    file: "sonoma-cutrer-founders-chardonnay.png",
    beverageType: "wine",
    brandName: "Sonoma-Cutrer",
    classType: "Chardonnay",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Sonoma-Cutrer Vineyards, Windsor, CA 95492",
    country: "United States",
  },
  {
    file: "sonoma-cutrer-les-pierres-chardonnay.png",
    beverageType: "wine",
    brandName: "Sonoma-Cutrer",
    classType: "Chardonnay",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Sonoma-Cutrer Vineyards, Windsor, CA 95492",
    country: "United States",
  },
  {
    file: "sonoma-cutrer-russian-river-pinot-noir.png",
    beverageType: "wine",
    brandName: "Sonoma-Cutrer",
    classType: "Pinot Noir",
    abv: "13.5% Alc./Vol.",
    netContents: "750 mL",
    bottler: "Sonoma-Cutrer Vineyards, Windsor, CA 95492",
    country: "United States",
  },
  // ── Beer ──────────────────────────────────────────────────
  {
    file: "founders-all-day-ipa.png",
    beverageType: "beer",
    brandName: "All Day IPA",
    classType: "American India Pale Ale",
    abv: "4.7% Alc./Vol.",
    netContents: "12 fl oz",
    bottler: "Founders Brewing Co., Grand Rapids, MI 49507",
    country: "United States",
  },
  {
    file: "harbor-lager.png",
    beverageType: "beer",
    brandName: "HARBOR LIGHT",
    classType: "AMERICAN LAGER",
    abv: "5% ALC./VOL.",
    netContents: "12 FL. OZ.",
    bottler: "Harbor Light Brewing, Portland, ME",
    country: "United States",
  },
];

async function runSingleVerification(page: Page, fixture: Fixture) {
  // networkidle waits for JS bundles + React hydration before we interact
  await page.goto("/", { timeout: 60_000, waitUntil: "networkidle" });

  // Ensure single-label tab is active
  await page.getByRole("tab", { name: "Single label" }).click();

  // Wait for React hydration before uploading (prevents onChange race on production)
  await page.locator(".upload-zone").waitFor({ state: "visible" });

  // Upload the real fixture image
  const filePath = path.join(FIXTURES_DIR, fixture.file);
  await page.locator("#label-image").setInputFiles(filePath);

  // Preview should appear (verifies image parsing didn't crash)
  await expect(page.getByAltText("Selected label preview")).toBeVisible({
    timeout: 5_000,
  });

  // Beverage type
  await page.selectOption("#beverage-type", fixture.beverageType);

  // Application fields
  await page.getByLabel("Brand name", { exact: true }).fill(fixture.brandName);
  await page.getByLabel("Class or type", { exact: true }).fill(fixture.classType);
  await page.getByLabel("Alcohol content", { exact: true }).fill(fixture.abv);
  await page.getByLabel("Net contents", { exact: true }).fill(fixture.netContents);
  await page
    .getByLabel("Bottler or producer name and address", { exact: true })
    .fill(fixture.bottler);
  await page.getByLabel("Country of origin", { exact: true }).fill(fixture.country);

  // Government warning must be pre-filled
  await expect(page.locator("#government_warning")).not.toBeEmpty();

  // Submit
  await page.getByRole("button", { name: "Verify label" }).click();

  // Submitting state
  await expect(
    page.getByRole("button", { name: /Analyzing label/i }),
  ).toBeVisible({ timeout: 5_000 });

  // Wait for AI response — real images can take a while
  await expect(
    page.getByRole("heading", { name: "Review the label results" }),
  ).toBeVisible({ timeout: 90_000 });

  // No error banner
  await expect(page.locator(".request-error")).not.toBeVisible();

  // All 7 result cards
  const cards = page.locator("[data-testid^='result-']");
  await expect(cards).toHaveCount(7);

  // Every card has a valid verdict class
  for (const card of await cards.all()) {
    const cls = await card.getAttribute("class");
    expect(cls).toMatch(/verdict-(match|needs-review|mismatch|not-applicable)/);
  }

  // Overall badge is visible and non-empty
  const badge = page.locator(".overall-badge");
  await expect(badge).toBeVisible();
  await expect(badge).not.toBeEmpty();

  // Reset flow works — upload zone returns
  await page.getByRole("button", { name: "Verify another label" }).click();
  await expect(
    page.getByRole("heading", { name: "Check one label" }),
  ).toBeVisible();
  await expect(page.getByAltText("Selected label preview")).not.toBeVisible();
}

// One test per fixture — allow up to 3 minutes for the AI round-trip + reset
for (const fixture of FIXTURES) {
  test(`single upload: ${fixture.file}`, async ({ page }) => {
    test.setTimeout(180_000);
    await runSingleVerification(page, fixture);
  });
}

// Batch smoke: 3 real images across all 3 beverage types
test("batch upload: mixed beverage types with real images", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch upload" }).click();

  const csvRows = [
    `filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning`,
    `buffalo-trace-bourbon.png,distilled_spirits,Buffalo Trace,Kentucky Straight Bourbon Whiskey,45% Alc./Vol.,750 mL,"Buffalo Trace Distillery, Frankfort, KY 40601",United States,"${GOV_WARNING}"`,
    `la-crema-pinot-noir.png,wine,La Crema,Pinot Noir,13.5% Alc./Vol.,750 mL,"La Crema Winery, Santa Rosa, CA 95403",United States,"${GOV_WARNING}"`,
    `harbor-lager.png,beer,HARBOR LIGHT,AMERICAN LAGER,5% ALC./VOL.,12 FL. OZ.,"Harbor Light Brewing, Portland, ME",United States,"${GOV_WARNING}"`,
  ].join("\n");

  await page.getByLabel("CSV manifest").setInputFiles({
    name: "manifest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvRows),
  });

  await page.getByLabel("Label images").setInputFiles([
    path.join(FIXTURES_DIR, "buffalo-trace-bourbon.png"),
    path.join(FIXTURES_DIR, "la-crema-pinot-noir.png"),
    path.join(FIXTURES_DIR, "harbor-lager.png"),
  ]);

  await page.getByRole("button", { name: "Create batch job" }).click();

  // Should enter a processing/job state
  await expect(
    page.getByText(/batch|job|queued|processing|submitted/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});
