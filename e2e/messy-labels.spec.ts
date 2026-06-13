import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/messy-labels");

interface Label {
  file: string;
  beverage: "distilled_spirits" | "wine" | "beer";
  brand: string;
  classType: string;
  abv: string;
  netContents: string;
  bottler: string;
  country: string;
}

const LABELS: Label[] = [
  {
    file: "ardbeg-whisky.jpg",
    beverage: "distilled_spirits",
    brand: "Ardbeg",
    classType: "Single Malt Scotch Whisky",
    abv: "46% Alc./Vol.",
    netContents: "700 ml",
    bottler: "Gordon & MacPhail Ltd, Elgin, Scotland",
    country: "Scotland",
  },
  {
    file: "our-house-rye.jpg",
    beverage: "distilled_spirits",
    brand: "Our House",
    classType: "Rye Whiskey",
    abv: "100 proof",
    netContents: "1 quart",
    bottler: "Our House Wine & Liquor Co.",
    country: "United States",
  },
  {
    file: "chapoutier-wine.jpg",
    beverage: "wine",
    brand: "M. Chapoutier",
    classType: "Côtes du Rhône",
    abv: "13% Alc. by Vol.",
    netContents: "750 ml",
    bottler: "M. Chapoutier, Tain-l'Hermitage, France",
    country: "France",
  },
  {
    file: "spitfire-ale.jpg",
    beverage: "beer",
    brand: "Spitfire",
    classType: "Bottle Conditioned Ale",
    abv: "4.5% Alc./Vol.",
    netContents: "500 ml",
    bottler: "Shepherd Neame Ltd, Faversham, Kent, England",
    country: "United Kingdom",
  },
];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/", { timeout: 90_000, waitUntil: "networkidle" });
  await page.close();
});

async function runVerification(page: Page, label: Label) {
  await page.goto("/", { timeout: 60_000, waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Single label" }).click();
  await page.locator(".upload-zone").waitFor({ state: "visible" });

  const filePath = path.join(FIXTURES_DIR, label.file);
  await page.locator("#label-image").setInputFiles(filePath);
  await expect(page.getByAltText("Selected label preview")).toBeVisible({ timeout: 5_000 });

  await page.selectOption("#beverage-type", label.beverage);
  await page.fill("#brand_name", label.brand);
  await page.fill("#class_type", label.classType);
  await page.fill("#abv", label.abv);
  await page.fill("#net_contents", label.netContents);
  await page.fill("#bottler", label.bottler);
  await page.fill("#country", label.country);

  await page.getByRole("button", { name: "Verify label" }).click();

  await expect(page.locator(".results-panel")).toBeVisible({ timeout: 90_000 });
  expect(await page.locator(".result-card").count()).toBeGreaterThan(0);
  await expect(page.locator(".request-error")).not.toBeVisible();
}

for (const label of LABELS) {
  test(`messy label: ${label.file}`, async ({ page }) => {
    test.setTimeout(180_000);
    await runVerification(page, label);
  });
}

test("oversized image shows client-side error without submitting", async ({ page }) => {
  await page.goto("/", { timeout: 60_000, waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Single label" }).click();
  await page.locator(".upload-zone").waitFor({ state: "visible" });

  // Inject a synthetic 6 MB JPEG (magic bytes only) via DataTransfer
  await page.evaluate(() => {
    const bytes = new Uint8Array(6 * 1024 * 1024);
    bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
    const file = new File([bytes], "too-big.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.querySelector<HTMLInputElement>("#label-image")!;
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await page.fill("#brand_name", "Test Brand");
  await page.fill("#class_type", "Bourbon Whiskey");
  await page.fill("#abv", "40% Alc./Vol.");
  await page.fill("#net_contents", "750 ml");
  await page.fill("#bottler", "Test Distillery, Louisville, KY");
  await page.fill("#country", "United States");

  await page.getByRole("button", { name: "Verify label" }).click();

  await expect(page.locator(".field-error").first()).toBeVisible({ timeout: 3_000 });
  await expect(page.locator(".results-panel")).not.toBeVisible();
});
