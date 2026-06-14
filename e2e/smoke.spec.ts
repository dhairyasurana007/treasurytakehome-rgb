import { expect, test } from "@playwright/test";

test("loads the application shell and switches workflows", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Alcohol Label Verification" }),
  ).toBeVisible();
  await expect(page.getByTestId("single-panel")).toBeVisible();

  await page.getByTestId("batch-tab").click();
  await expect(page.getByTestId("batch-panel")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Check multiple labels" }),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("health endpoint reports readiness", async ({ request }) => {
  await expect
    .poll(
      async () => {
        const response = await request.get("/api/health");
        return response.status();
      },
      { timeout: 30_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toBe(200);

  const response = await request.get("/api/health");
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "ttb-label-verifier",
  });
});
