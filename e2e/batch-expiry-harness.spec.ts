import { expect, test } from "@playwright/test";

test("removes expired data and distinguishes expired from unknown jobs", async ({
  page,
}) => {
  await page.goto("/test-harness/batch-expiry");
  await page.getByRole("button", { name: "Verify expiry" }).click();
  await expect(page.getByTestId("expiry-result")).toHaveText(
    "Expired: 410. Unknown: 404. Retained rows: 0.",
  );
});
