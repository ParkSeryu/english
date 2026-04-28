import { describe, expect, it, vi } from "vitest";

import { safeSameOriginRedirectPath } from "@/lib/safe-redirect";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: vi.fn() }
  }))
}));

describe("auth callback redirect safety", () => {
  it.each([
    ["/cards", "/cards"],
    ["/review?mode=confusing#today", "/review?mode=confusing#today"],
    [null, "/"],
    ["https://evil.example", "/"],
    ["//evil.example/path", "/"],
    ["/\\evil.example", "/"],
    ["/%5Cevil.example", "/"],
    ["/%255Cevil.example", "/"],
    ["/%2Fevil.example", "/"],
    ["/\t/evil.example", "/"],
    ["/%09/evil.example", "/"],
    ["cards", "/"]
  ])("normalizes %s to %s", (rawNext, expected) => {
    expect(safeSameOriginRedirectPath(rawNext, "https://app.example")).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/%5Cevil.example",
    "/%255Cevil.example",
    "/%2Fevil.example",
    "/%09/evil.example"
  ])("falls back to the app origin for unsafe callback next=%s", async (nextValue) => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request(`https://app.example/auth/callback?next=${encodeURIComponent(nextValue)}`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/");
  });

  it("keeps same-origin relative callback paths", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://app.example/auth/callback?next=/review?mode=confusing"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/review?mode=confusing");
  });
});
