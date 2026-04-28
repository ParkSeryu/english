import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-lesson");
  expect(seed.ok()).toBe(true);
});

test("mobile user can review an LLM-added lesson and mark confusion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: /오늘 복습 시작/ })).toBeVisible();
  await expect(page.getByText("have to / be used to")).toBeVisible();

  await page.getByRole("link", { name: /^레슨$/ }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.getByRole("link", { name: /have to \/ be used to/ }).click();
  await expect(page.getByText("have to ~")).toBeVisible();
  await expect(page.getByText("I am used to ~")).toBeVisible();

  await page.getByRole("link", { name: /^복습$/ }).click();
  await expect(page.getByText("~해야 한다 / ~할 필요가 있다")).toBeVisible();
  await expect(page.getByText("have to ~")).toHaveCount(0);

  await page.getByRole("button", { name: /정답 보기/ }).click();
  await expect(page.getByText("have to ~")).toBeVisible();
  await page.getByRole("button", { name: /아직 헷갈려요/ }).click();

  await page.getByRole("link", { name: /헷갈린 표현만/ }).click();
  await expect(page.getByText("have to ~")).toHaveCount(0);
  await expect(page.getByText("~해야 한다 / ~할 필요가 있다")).toBeVisible();
  await page.getByRole("button", { name: /정답 보기/ }).click();
  await expect(page.getByText("have to ~")).toBeVisible();
});

test("mobile item detail persists user memo and confusion note", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lessons");

  await page.getByRole("link", { name: /have to \/ be used to/ }).click();
  await page.getByRole("link", { name: /I am used to ~/ }).click();

  await page.getByLabel(/내 메모/).fill("to 다음에 ing가 온다는 점을 암기");
  await page.getByLabel(/헷갈린 점/).fill("used to 동사원형과 구분하기");
  await page.getByRole("button", { name: /메모 저장/ }).click();
  await expect(page.getByText("메모를 저장했습니다.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/내 메모/)).toHaveValue("to 다음에 ing가 온다는 점을 암기");
  await expect(page.getByLabel(/헷갈린 점/)).toHaveValue("used to 동사원형과 구분하기");
});
