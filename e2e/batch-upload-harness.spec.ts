import { expect, test } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
const validCsv = `filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning\nLABEL.PNG,distilled_spirits,Brand,Bourbon,45%,750 mL,Bottler,USA,"${warning}"`;

test.beforeEach(async ({ page }) => {
  await page.goto("/test-harness/batch-upload");
});

test("uploads separate manifest and image requests then finalizes atomically", async ({
  page,
}) => {
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "manifest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(validCsv),
  });
  await page.getByLabel("Label images").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByRole("button", { name: "Upload and finalize" }).click();
  await expect(page.getByTestId("batch-upload-result")).toContainText(
    "Batch finalized:",
  );
});

test("does not create a job for missing or invalid coverage", async ({ page }) => {
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "manifest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(validCsv.replace("LABEL.PNG", "missing.png")),
  });
  await page.getByLabel("Label images").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByRole("button", { name: "Upload and finalize" }).click();
  await expect(page.getByTestId("batch-upload-result")).toContainText(
    "No uploaded image matches missing.png.",
  );
});

test("rejects malformed CSV and unsupported image bytes", async ({ page }) => {
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "manifest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('"broken'),
  });
  await page.getByLabel("Label images").setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Upload and finalize" }).click();
  await expect(page.getByTestId("batch-upload-result")).toContainText(
    "CSV structure or quoting is invalid.",
  );
});
