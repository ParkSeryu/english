import { request, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required for e2e warmup.");

  const context = await request.newContext({ baseURL });
  try {
    const response = await context.get("/");
    if (!response.ok()) {
      throw new Error(`E2E dev-server warmup failed: GET / returned ${response.status()}`);
    }
  } finally {
    await context.dispose();
  }
}
