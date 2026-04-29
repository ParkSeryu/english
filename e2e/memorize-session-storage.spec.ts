import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-expression-day");
  expect(seed.ok()).toBe(true);
});

test("memorize queue keeps the current card after marking unknown and reloading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/memorize");

  await expect(page.getByText("한국의 출산율이 감소하고 있어요.")).toBeVisible();
  await page.getByRole("button", { name: /정답 보기/ }).click();
  await page.getByRole("button", { name: /모름/ }).click();

  await expect(page.getByText("저는 먹지 않으려고 노력해요.")).toBeVisible();
  await expect(page.getByText("I try not to eat.")).toHaveCount(0);

  await page.reload();

  await expect(page.getByText("저는 먹지 않으려고 노력해요.")).toBeVisible();
  await expect(page.getByText("한국의 출산율이 감소하고 있어요.")).toHaveCount(0);
});
