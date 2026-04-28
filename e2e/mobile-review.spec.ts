import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-lesson");
  expect(seed.ok()).toBe(true);
});

test("mobile user can memorize an LLM-approved expression and mark unknown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: /오늘 암기 시작/ })).toBeVisible();
  await expect(page.getByText("have to / be used to")).toBeVisible();

  await page.getByRole("link", { name: /^표현$/ }).click();
  await expect(page).toHaveURL(/\/expressions$/);
  await expect(page.getByText("have to ~")).toBeVisible();
  await expect(page.getByText("I am used to ~")).toBeVisible();

  await page.getByRole("link", { name: /^암기$/ }).click();
  await expect(page.getByText("~해야 한다 / ~할 필요가 있다")).toBeVisible();
  await expect(page.getByText("have to ~")).toHaveCount(0);

  await page.getByRole("button", { name: /정답 보기/ }).click();
  await expect(page.getByText("have to ~")).toBeVisible();
  await page.getByRole("button", { name: /모름/ }).click();
  await expect(page.getByText("~에 익숙하다")).toBeVisible();
  await expect(page.getByText("I am used to ~")).toHaveCount(0);
});

test("mobile user can add a question note", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/questions");

  await page.getByLabel(/질문거리/).fill("have to와 must의 차이는?");
  await page.getByRole("button", { name: /질문 추가/ }).click();
  await expect(page.getByText("질문거리를 추가했습니다.")).toBeVisible();
  await expect(page.getByText("have to와 must의 차이는?")).toBeVisible();
  await page.getByRole("button", { name: /물어봄으로 표시/ }).click();
  await expect(page.getByText("물어봄")).toBeVisible();
});
