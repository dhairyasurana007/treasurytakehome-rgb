import { expect, test } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/test-harness/provider");
  await page.getByLabel("Test image").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
});

test("returns a deterministic verification result", async ({ page }) => {
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByTestId("provider-result")).toHaveText(
    "Verification complete: match.",
  );
});

test("shows a safe provider failure", async ({ page }) => {
  await page.getByLabel("Provider scenario").selectOption("error");
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByTestId("provider-result")).toHaveText(
    "Verification failed: The label could not be analyzed. Please try again.",
  );
  await expect(page.locator("body")).not.toContainText("OPENROUTER_API_KEY");
});
