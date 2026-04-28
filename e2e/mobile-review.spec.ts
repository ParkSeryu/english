import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/test/reset");
  expect(response.ok()).toBe(true);
});

test("mobile user can create, review, mark confusing, revisit, and mark known", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: /오늘 복습 시작/ })).toBeVisible();
  await page.getByRole("link", { name: /첫 카드 만들기/ }).click();

  await page.getByLabel(/영어 문장/).fill("Could you elaborate on that?");
  await page.getByLabel(/한국어 뜻/).fill("그 부분을 좀 더 자세히 설명해 주실 수 있나요?");
  await page.getByLabel(/문법/).fill("Could you + base verb is a polite request pattern.");
  await page.getByLabel(/예문 1/).fill("Could you elaborate on your plan?");
  await page.getByRole("button", { name: /카드 만들기/ }).click();

  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByText("Could you elaborate on that?")).toBeVisible();

  await page.getByRole("link", { name: /^복습$/ }).click();
  await expect(page.getByText("Could you elaborate on that?")).toBeVisible();
  await expect(page.getByText("그 부분을 좀 더 자세히 설명해 주실 수 있나요?")).toHaveCount(0);

  await page.getByRole("button", { name: /정답 보기/ }).click();
  await expect(page.getByText("그 부분을 좀 더 자세히 설명해 주실 수 있나요?")).toBeVisible();
  await page.getByRole("button", { name: /아직 헷갈려요/ }).click();

  await page.getByRole("link", { name: /헷갈린 카드만|헷갈린 카드 다시 보기/ }).click();
  await expect(page.getByText("Could you elaborate on that?")).toBeVisible();
  await page.getByRole("button", { name: /정답 보기/ }).click();
  await page.getByRole("button", { name: /알고 있었어요/ }).click();

  await expect(page).toHaveURL(/\/review\/confusing$/);
  await expect(page.getByText("Could you elaborate on that?")).toHaveCount(0);
});

test("mobile card edit flow persists changes in guarded e2e store", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards/new");

  await page.getByLabel(/영어 문장/).fill("I am into reading.");
  await page.getByLabel(/한국어 뜻/).fill("나는 독서에 빠져 있어.");
  await page.getByLabel(/문법/).fill("be into + noun or gerund");
  await page.getByLabel(/예문 1/).fill("I am into reading mystery novels.");
  await page.getByRole("button", { name: /카드 만들기/ }).click();

  await page.getByRole("link", { name: /수정/ }).last().click();
  await page.getByLabel(/영어 문장/).fill("I am really into reading.");
  await page.getByRole("button", { name: /변경사항 저장/ }).click();

  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByText("I am really into reading.")).toBeVisible();
});
