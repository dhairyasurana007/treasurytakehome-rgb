import { expect, test } from "@playwright/test";

test("shows every deterministic comparison verdict", async ({ page }) => {
  await page.goto("/test-harness/comparison");

  await expect(
    page.getByRole("heading", { name: "Comparison verdict harness" }),
  ).toBeVisible();
  await expect(page.getByTestId("verdict-match")).toHaveCount(4);
  await expect(page.getByTestId("verdict-needs-review")).toHaveCount(1);
  await expect(page.getByTestId("verdict-mismatch")).toHaveCount(1);
  await expect(page.getByTestId("verdict-not-applicable")).toHaveCount(1);
  await expect(
    page.getByText(
      "Extracted: STONE'S THROW | Submitted: Stone's Throw",
      { exact: true },
    ),
  ).toBeVisible();
});
