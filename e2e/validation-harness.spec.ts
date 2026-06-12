import { expect, test } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("validates image bytes without making a model request", async ({ page }) => {
  await page.goto("/test-harness/validation");
  const input = page.getByLabel("Test image");

  await input.setInputFiles({
    name: "renamed.JPG",
    mimeType: "text/plain",
    buffer: PNG_1X1,
  });
  await page.getByRole("button", { name: "Validate upload" }).click();
  await expect(page.getByTestId("validation-result")).toHaveText(
    "Valid image. Model submitted: false.",
  );
});

test("rejects unsupported bytes without making a model request", async ({ page }) => {
  await page.goto("/test-harness/validation");
  await page.getByLabel("Test image").setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Validate upload" }).click();
  await expect(page.getByTestId("validation-result")).toContainText(
    "Choose a JPEG, PNG, or WebP image.",
  );
  await expect(page.getByTestId("validation-result")).toContainText(
    "Model submitted: false.",
  );
});
