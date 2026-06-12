import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function completeForm(page: Page) {
  await page.getByLabel("Choose label artwork").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByLabel("Brand name", { exact: true }).fill("OLD TOM DISTILLERY");
  await page
    .getByLabel("Class or type", { exact: true })
    .fill("Kentucky Straight Bourbon Whiskey");
  await page.getByLabel("Alcohol content", { exact: true }).fill("45%");
  await page.getByLabel("Net contents", { exact: true }).fill("750 mL");
  await page
    .getByLabel("Bottler or producer name and address", { exact: true })
    .fill("Old Tom Distillery, Louisville, KY");
  await page.getByLabel("Country of origin", { exact: true }).fill("United States");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("completes the single-label workflow and resets", async ({ page }) => {
  await completeForm(page);
  await expect(page.getByAltText("Selected label preview")).toBeVisible();
  await page.getByRole("button", { name: "Verify label" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the label results" }),
  ).toBeVisible();
  await expect(page.locator("[data-testid^='result-']")).toHaveCount(7);
  await page.getByRole("button", { name: "Verify another label" }).click();
  await expect(page.getByRole("heading", { name: "Check one label" })).toBeVisible();
});

test("shows inline validation and mandatory warning behavior", async ({ page }) => {
  await page.getByRole("button", { name: "Verify label" }).click();
  await expect(page.getByText("Choose a label image.")).toBeVisible();
  await expect(page.getByText("Always required")).toBeVisible();

  const countryRequired = page.getByLabel(
    "Country of origin required on this application",
  );
  await countryRequired.uncheck();
  await expect(
    page.getByLabel("Country of origin", { exact: true }),
  ).toBeDisabled();
});

test("shows a plain-language API failure", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Something went wrong. Please try again." }),
    });
  });
  await completeForm(page);
  await page.getByRole("button", { name: "Verify label" }).click();
  await expect(page.locator(".request-error")).toContainText(
    "Something went wrong. Please try again.",
  );
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
