/**
 * Batch acceptance tests — fake provider, high concurrency.
 * Verifies that 200- and 300-item batches process fully end-to-end.
 * Runs against the local dev:test server (EXTRACTION_MODE=mock).
 * Large live-provider batches are kept manually triggered.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function makeCsv(count: number): string {
  const header =
    "filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning";
  const rows = Array.from(
    { length: count },
    (_, i) =>
      `label-${i + 1}.png,distilled_spirits,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45%,750 mL,"Old Tom Distillery, Louisville, KY",United States,"${WARNING}"`,
  );
  return [header, ...rows].join("\n");
}

async function createBatchJob(
  request: APIRequestContext,
  count: number,
): Promise<string> {
  const draftResp = await request.post("/api/batch/drafts");
  expect(draftResp.status()).toBe(201);
  const { id: draftId } = (await draftResp.json()) as { id: string };

  const manifestResp = await request.post(`/api/batch/drafts/${draftId}/manifest`, {
    multipart: {
      manifest: {
        name: "batch.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(makeCsv(count)),
      },
    },
  });
  expect(manifestResp.status()).toBe(200);

  const names = Array.from({ length: count }, (_, i) => `label-${i + 1}.png`);
  await Promise.all(
    names.map((name) =>
      request.post(`/api/batch/drafts/${draftId}/images`, {
        multipart: {
          image: { name, mimeType: "image/png", buffer: PNG_1X1 },
        },
      }),
    ),
  );

  const finalResp = await request.post(`/api/batch/drafts/${draftId}/finalize`);
  expect(finalResp.status()).toBe(201);
  const { jobId } = (await finalResp.json()) as { jobId: string };
  return jobId;
}

test("200-item batch completes fully with fake provider", async ({ page, request }) => {
  test.setTimeout(180_000);
  const jobId = await createBatchJob(request, 200);
  await page.goto(`/batch/${jobId}`);
  await expect(page.getByTestId("job-progress")).toContainText("200 of 200", {
    timeout: 120_000,
  });
  const items = page.getByTestId("batch-item");
  await expect(items).toHaveCount(200);
  await expect(items.first()).toContainText("completed");
  await expect(items.last()).toContainText("completed");
});

test("300-item batch completes fully with fake provider", async ({ page, request }) => {
  test.setTimeout(240_000);
  const jobId = await createBatchJob(request, 300);
  await page.goto(`/batch/${jobId}`);
  await expect(page.getByTestId("job-progress")).toContainText("300 of 300", {
    timeout: 180_000,
  });
  const items = page.getByTestId("batch-item");
  await expect(items).toHaveCount(300);
  await expect(items.first()).toContainText("completed");
  await expect(items.last()).toContainText("completed");
});
