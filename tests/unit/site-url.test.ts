import { describe, expect, it } from "vitest";

import { passwordResetRedirectUrl, resolveAppOrigin } from "@/lib/site-url";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("site URL resolution", () => {
  it("uses configured production site URL before localhost request origins", () => {
    const origin = resolveAppOrigin(headers({ origin: "http://localhost:3000", host: "localhost:3000" }), {
      NEXT_PUBLIC_SITE_URL: "https://english.example",
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined
    });

    expect(origin).toBe("https://english.example");
  });

  it("uses forwarded deployment host when no explicit site URL is configured", () => {
    const origin = resolveAppOrigin(headers({ origin: "http://localhost:3000", "x-forwarded-host": "english.example", "x-forwarded-proto": "https" }), {
      NEXT_PUBLIC_SITE_URL: undefined,
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined
    });

    expect(origin).toBe("https://english.example");
  });

  it("uses Vercel production URL before falling back to localhost", () => {
    const origin = resolveAppOrigin(headers({ origin: "http://localhost:3000", host: "localhost:3000" }), {
      NEXT_PUBLIC_SITE_URL: undefined,
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: "english.example",
      VERCEL_URL: "preview.example"
    });

    expect(origin).toBe("https://english.example");
  });

  it("builds password reset callback URL from the resolved app origin", () => {
    expect(
      passwordResetRedirectUrl(headers({ host: "english.example", "x-forwarded-proto": "https" }), {
        NEXT_PUBLIC_SITE_URL: undefined,
        SITE_URL: undefined,
        VERCEL_PROJECT_PRODUCTION_URL: undefined,
        VERCEL_URL: undefined
      })
    ).toBe("https://english.example/auth/callback?next=/login");
  });
});
