import { expect, test } from "@playwright/test";

test("persists a completed fixture job across navigation and reload", async ({
  page,
}) => {
  await page.goto("/test-harness/batch-storage");
  await page.getByRole("button", { name: "Create fixture job" }).click();
  await page.waitForURL(/\/test-harness\/batch-storage\/[a-f0-9-]+/);
  const jobUrl = page.url();
  await expect(page.getByTestId("stored-job-status")).toHaveText(
    "2 of 2 completed. Status: completed.",
  );
  await page.goto("/");
  await page.goto(jobUrl);
  await expect(page.getByTestId("stored-job-status")).toHaveText(
    "2 of 2 completed. Status: completed.",
  );
  await page.reload();
  await expect(page.getByText("label-a.png")).toBeVisible();
  await expect(page.getByText("label-b.png")).toBeVisible();
});
