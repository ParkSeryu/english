import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

describe("root auth code redirect", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends root password-reset auth codes through the callback route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon-key");

    const response = await middleware(new NextRequest("https://english.example/?code=reset-code"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://english.example/auth/callback?code=reset-code&next=%2Fauth%2Fupdate-password");
  });
});
