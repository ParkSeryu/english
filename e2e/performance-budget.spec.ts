import { expect, test } from "@playwright/test";

const DESKTOP_FCP_BUDGET_MS = 3000;
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BUDGETED_ROUTES = ["/", "/expressions", "/memorize", "/questions"];
const MEASURED_ATTEMPTS_PER_ROUTE = 2;

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/test/reset");
  expect(reset.ok()).toBe(true);
  const seed = await request.post("/test/seed-approved-expression-day");
  expect(seed.ok()).toBe(true);
});

test("desktop FCP stays under the 3s Speed Insights budget @perf", async ({ baseURL, browser }) => {
  const context = await browser.newContext({
    baseURL,
    userAgent: DESKTOP_USER_AGENT,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const results: Array<{ route: string; budgetFcp: number | null; samples: Array<number | null> }> = [];

  try {
    for (const route of BUDGETED_ROUTES) {
      await page.goto(route, { waitUntil: "load" });
    }

    for (const route of BUDGETED_ROUTES) {
      const samples: Array<number | null> = [];

      for (let attempt = 0; attempt < MEASURED_ATTEMPTS_PER_ROUTE; attempt += 1) {
        await page.goto(route, { waitUntil: "load" });
        await expect(page.locator("body")).toBeVisible();

        samples.push(
          await page.evaluate(() => {
            const entry = performance.getEntriesByName("first-contentful-paint")[0];
            return entry?.startTime ?? null;
          })
        );
      }

      const numericSamples = samples.filter((sample): sample is number => sample !== null);
      const fcp = numericSamples.length > 0 ? Math.min(...numericSamples) : null;
      results.push({ route, budgetFcp: fcp, samples });

      expect(fcp, `${route} should expose first-contentful-paint`).not.toBeNull();
      expect.soft(fcp ?? Number.POSITIVE_INFINITY, `${route} desktop FCP`).toBeLessThanOrEqual(DESKTOP_FCP_BUDGET_MS);
    }

    console.log(
      `Desktop FCP budget (${DESKTOP_FCP_BUDGET_MS}ms): ${results
        .map(({ route, budgetFcp, samples }) => {
          const formattedSamples = samples.map((sample) => (sample === null ? "missing" : `${Math.round(sample)}ms`)).join("/");
          return `${route}=${budgetFcp === null ? "missing" : `${Math.round(budgetFcp)}ms`} [${formattedSamples}]`;
        })
        .join(", ")}`
    );
  } finally {
    await context.close();
  }
});
