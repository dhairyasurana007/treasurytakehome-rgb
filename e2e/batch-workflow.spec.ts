import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function csv(names: string[]) {
  const header =
    "filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning";
  return [
    header,
    ...names.map(
      (name) =>
        `${name},distilled_spirits,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45%,750 mL,"Old Tom Distillery, Louisville, KY",United States,"${warning}"`,
    ),
  ].join("\n");
}

async function openBatch(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch upload" }).click();
}

async function submitBatch(page: Page, names: string[]) {
  await openBatch(page);
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv(names)),
  });
  await page.getByLabel("Label images").setInputFiles(
    names.map((name) => ({
      name,
      mimeType: "image/png",
      buffer: PNG_1X1,
    })),
  );
  await page.getByRole("button", { name: "Create batch job" }).click();
  await page.waitForURL(/\/batch\/[a-f0-9-]+/);
}

test("finalizes, survives navigation, preserves order, and appears in recent jobs", async ({
  page,
  context,
}) => {
  await submitBatch(page, ["slow-a.png", "slow-b.png", "slow-c.png"]);
  const jobUrl = page.url();
  await expect(page.getByText("Available until")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy job link" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch upload" }).click();
  await expect(page.getByRole("link", { name: "batch.csv" })).toBeVisible();
  await page.goto(jobUrl);
  await expect(page.getByTestId("job-progress")).toContainText("3 of 3");
  await expect(page.getByTestId("batch-item")).toHaveCount(3);
  await expect(page.getByTestId("batch-item").nth(0)).toContainText("slow-a.png");
  await expect(page.getByTestId("batch-item").nth(2)).toContainText("slow-c.png");

  const separateBrowser = await context.browser()!.newContext();
  const secondPage = await separateBrowser.newPage();
  await secondPage.goto(jobUrl);
  await expect(secondPage.getByTestId("job-progress")).toContainText("3 of 3");
  await separateBrowser.close();
});

test("supports a manual retry for a failed item", async ({ page }) => {
  await submitBatch(page, ["retry-once.png"]);
  await expect(page.getByText("Fixture item requires a manual retry.")).toBeVisible();
  await page.getByRole("button", { name: "Retry this label" }).click();
  await expect(page.getByTestId("job-progress")).toContainText("1 of 1");
  await expect(page.getByTestId("batch-item")).toContainText("completed");
});

test("shows unknown state and removes expired recent entries", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ttb-recent-batch-jobs",
      JSON.stringify([
        {
          id: "expired-local",
          label: "expired.csv",
          expiresAt: "2000-01-01T00:00:00.000Z",
        },
      ]),
    );
  });
  await openBatch(page);
  await expect(page.getByText("expired.csv")).toHaveCount(0);
  await page.goto("/batch/never-issued");
  await expect(page.getByRole("heading", { name: "Batch job not found." })).toBeVisible();
});

test("shows an expired state and removes that server-expired recent job", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/test-harness/batch-expiry");
  const { jobId } = (await created.json()) as { jobId: string };
  await page.addInitScript((id) => {
    localStorage.setItem(
      "ttb-recent-batch-jobs",
      JSON.stringify([
        {
          id,
          label: "server-expired.csv",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      ]),
    );
  }, jobId);
  await page.goto(`/batch/${jobId}`);
  await expect(
    page.getByRole("heading", { name: "This batch job has expired." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem("ttb-recent-batch-jobs"),
      ),
    )
    .toBe("[]");
});

test("batch upload screen has no detectable accessibility violations", async ({
  page,
}) => {
  await openBatch(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
