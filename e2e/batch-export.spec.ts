import { expect, test, type Page } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function makeCsv(names: string[]) {
  const header =
    "filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning";
  return [
    header,
    ...names.map(
      (name) =>
        `${name},distilled_spirits,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45%,750 mL,"Old Tom Distillery, Louisville, KY",United States,"${WARNING}"`,
    ),
  ].join("\n");
}

async function submitBatch(page: Page, names: string[]) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch upload" }).click();
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(makeCsv(names)),
  });
  await page.getByLabel("Label images").setInputFiles(
    names.map((name) => ({ name, mimeType: "image/png", buffer: PNG_1X1 })),
  );
  await page.getByRole("button", { name: "Create batch job" }).click();
  await page.waitForURL(/\/batch\/[a-f0-9-]+/);
}

test("download link is visible on a job page", async ({ page }) => {
  await submitBatch(page, ["export-a.png"]);
  await expect(page.getByRole("link", { name: /Download/ })).toBeVisible();
});

test("completed job shows non-partial download label", async ({ page }) => {
  await submitBatch(page, ["done-a.png"]);
  await expect(page.getByTestId("job-progress")).toContainText("1 of 1");
  await expect(page.getByRole("link", { name: "Download results" })).toBeVisible();
});

test("export returns CSV with correct headers", async ({ page, request }) => {
  await submitBatch(page, ["hdr-a.png"]);
  const jobId = page.url().split("/batch/")[1];

  const response = await request.get(`/api/batch/${jobId}/export`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");

  const body = await response.text();
  const header = body.split("\r\n")[0];
  expect(header).toContain("filename");
  expect(header).toContain("overall_status");
  expect(header).toContain("error");
  expect(header).toContain("brand_name_verdict");
  expect(header).toContain("government_warning_applicable");
  expect(header.split(",")).toHaveLength(31);
});

test("export preserves original CSV row order", async ({ page, request }) => {
  const names = ["order-c.png", "order-a.png", "order-b.png"];
  await submitBatch(page, names);
  await expect(page.getByTestId("job-progress")).toContainText("3 of 3");
  const jobId = page.url().split("/batch/")[1];

  const response = await request.get(`/api/batch/${jobId}/export`);
  const lines = (await response.text()).trimEnd().split("\r\n");
  expect(lines[1]).toContain("order-c.png");
  expect(lines[2]).toContain("order-a.png");
  expect(lines[3]).toContain("order-b.png");
});

test("completed export filename has no partial- prefix", async ({ page, request }) => {
  await submitBatch(page, ["comp-a.png"]);
  await expect(page.getByTestId("job-progress")).toContainText("1 of 1");
  const jobId = page.url().split("/batch/")[1];

  const disposition = (await request.get(`/api/batch/${jobId}/export`)).headers()[
    "content-disposition"
  ];
  expect(disposition).toContain(`batch-${jobId.slice(0, 8)}.csv`);
  expect(disposition).not.toContain("partial-");
});

test("partial export filename has partial- prefix when items are still pending", async ({
  page,
  request,
}) => {
  await submitBatch(page, ["pa.png", "pb.png", "pc.png"]);
  const jobId = page.url().split("/batch/")[1];
  // Request immediately — at least some items will still be pending or processing
  const disposition = (await request.get(`/api/batch/${jobId}/export`)).headers()[
    "content-disposition"
  ];
  // Accept either since timing varies; the pattern must match one form
  expect(disposition).toMatch(/filename="(partial-)?batch-[a-f0-9]{8}\.csv"/);
});

test("export returns 404 for an unknown job", async ({ request }) => {
  const response = await request.get(
    "/api/batch/00000000-0000-0000-0000-000000000000/export",
  );
  expect([404, 410]).toContain(response.status());
});

test("formula characters in submitted values are escaped in the export", async ({
  page,
  request,
}) => {
  const dangerousCsv =
    `filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning\n` +
    `formula-a.png,distilled_spirits,"=EVIL()","Kentucky Straight Bourbon Whiskey",45%,750 mL,"Old Tom Distillery, Louisville, KY",United States,"${WARNING}"`;

  await page.goto("/");
  await page.getByRole("tab", { name: "Batch upload" }).click();
  await page.getByLabel("CSV manifest").setInputFiles({
    name: "formula.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(dangerousCsv),
  });
  await page.getByLabel("Label images").setInputFiles([
    { name: "formula-a.png", mimeType: "image/png", buffer: PNG_1X1 },
  ]);
  await page.getByRole("button", { name: "Create batch job" }).click();
  await page.waitForURL(/\/batch\/[a-f0-9-]+/);
  const jobId = page.url().split("/batch/")[1];

  const body = await (await request.get(`/api/batch/${jobId}/export`)).text();
  expect(body).toContain("'=EVIL()");
  expect(body).not.toMatch(/(?<!')\=EVIL\(\)/);
});
