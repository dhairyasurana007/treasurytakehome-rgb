import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-harness/batch-retry");
});

test("recovers transient and rate-limit failures", async ({ page }) => {
  await page.getByRole("button", { name: "Run transient" }).click();
  await expect(page.getByTestId("retry-result")).toContainText(
    "transient: completed 2, errors 0, attempts 2/1",
  );
  await page.getByRole("button", { name: "Run rate-limit" }).click();
  await expect(page.getByTestId("retry-result")).toContainText(
    "rate-limit: completed 2, errors 0, attempts 2/1",
  );
});

test("leaves permanent failures visible and supports manual retry", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Run permanent" }).click();
  await expect(page.getByTestId("retry-result")).toContainText(
    "permanent: completed 1, errors 1, attempts 1/1",
  );
  await page.getByRole("button", { name: "Run manual" }).click();
  await expect(page.getByTestId("retry-result")).toContainText(
    "manual: completed 2, errors 0, attempts 2/1",
  );
});
