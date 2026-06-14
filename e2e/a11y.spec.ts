import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function fillSingleLabel(page: Page) {
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

test.describe("Accessibility scans", () => {
  test("single-label results state has no detectable violations", async ({ page }) => {
    await page.goto("/");
    await fillSingleLabel(page);
    await page.getByRole("button", { name: "Verify label" }).click();
    await page.getByRole("heading", { name: "Review the label results" }).waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("batch upload tab has no detectable violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Batch upload" }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Focus management", () => {
  test("focus moves to results heading after submission", async ({ page }) => {
    await page.goto("/");
    await fillSingleLabel(page);
    await page.getByRole("button", { name: "Verify label" }).click();
    const heading = page.getByRole("heading", { name: "Review the label results" });
    await heading.waitFor();
    await expect(heading).toBeFocused();
  });
});

test.describe("Keyboard navigation", () => {
  test("file input is keyboard-focusable inside the upload zone", async ({ page }) => {
    await page.goto("/");
    await page.locator("#label-image").focus();
    await expect(page.locator("#label-image")).toBeFocused();
  });

  test("batch tab is keyboard-activatable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Batch upload" }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("heading", { name: "Check multiple labels" }),
    ).toBeVisible();
  });

  test("single tab is keyboard-activatable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Batch upload" }).click();
    await page.getByRole("tab", { name: "Single label" }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("heading", { name: "Check one label" }),
    ).toBeVisible();
  });
});

test.describe("Responsive layouts", () => {
  test("mobile 390px: key controls are visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Alcohol Label Verification" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify label" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Batch upload" })).toBeVisible();
  });

  test("mobile 390px: batch upload controls are visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Batch upload" }).click();
    await expect(page.getByRole("button", { name: "Create batch job" })).toBeVisible();
    await expect(page.getByLabel("CSV manifest")).toBeVisible();
  });

  test("tablet 768px: single-label form renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Check one label" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify label" })).toBeVisible();
  });
});
