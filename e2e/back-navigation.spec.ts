import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-expression-day");
  expect(seed.ok()).toBe(true);
});

test("mobile user can go back from an expression detail page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/expressions");

  await page.getByRole("link", { name: /The birth rate in Korea is decreasing/ }).click();
  await expect(page).toHaveURL(/\/expressions\//);
  await expect(page.getByRole("heading", { name: "The birth rate in Korea is decreasing." })).toBeVisible();

  await page.getByRole("button", { name: "뒤로 가기" }).click();

  await expect(page).toHaveURL(/\/expressions$/);
  await expect(page.getByRole("link", { name: /The birth rate in Korea is decreasing/ })).toBeVisible();
});
