import { expect, test } from "@playwright/test";

test("loads the application shell and switches workflows", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Compare label artwork with confidence." }),
  ).toBeVisible();
  await expect(page.getByTestId("single-panel")).toBeVisible();

  await page.getByTestId("batch-tab").click();
  await expect(page.getByTestId("batch-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Process a full importer submission" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("health endpoint reports readiness", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "ttb-label-verifier",
  });
});
