import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-expression-day");
  expect(seed.ok()).toBe(true);
});

test("mobile user memorizes a daily expression, marks unknown, and adds a question", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: /암기 시작/ })).toBeVisible();
  await expect(page.getByText("오늘의 영어표현")).toBeVisible();

  await page.getByRole("link", { name: /^표현$/ }).click();
  await expect(page).toHaveURL(/\/expressions$/);
  await page.getByRole("link", { name: /The birth rate in Korea is decreasing/ }).click();
  await expect(page.getByText("The birth rate in Korea is decreasing.")).toBeVisible();
  await expect(page.getByText("한국의 출산율이 감소하고 있어요.")).toBeVisible();

  await page.getByRole("link", { name: /^암기$/ }).click();
  await expect(page.getByText("한국의 출산율이 감소하고 있어요.")).toBeVisible();
  await expect(page.getByText("The birth rate in Korea is decreasing.")).toHaveCount(0);

  await page.getByRole("button", { name: /정답 보기/ }).click();
  await expect(page.getByText("The birth rate in Korea is decreasing.")).toBeVisible();
  await expect(page.getByText(/decrease는 '감소하다'/)).toBeVisible();
  await page.getByRole("button", { name: /모름/ }).click();
  await expect(page.getByText("저는 먹지 않으려고 노력해요.")).toBeVisible();
  await expect(page.getByText("I try not to eat.")).toHaveCount(0);

  await page.getByRole("link", { name: /^질문거리$/ }).click();
  await page.getByLabel(/질문/).fill("decrease와 reduce 차이를 수업 때 물어보기");
  await page.getByRole("button", { name: /추가/ }).click();
  await expect(page.getByText("decrease와 reduce 차이를 수업 때 물어보기")).toBeVisible();

  await page.getByRole("button", { name: /물어봄/ }).click();
  await expect(page.getByRole("button", { name: /다시 질문 예정/ })).toBeVisible();
});
