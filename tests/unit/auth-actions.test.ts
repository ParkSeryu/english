import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "english.example", "x-forwarded-proto": "https" })),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient
}));

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends password reset emails back to the password update flow", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { resetPasswordForEmail }
    });

    const { resetPasswordAction } = await import("@/app/actions");
    const formData = new FormData();
    formData.set("email", "student@example.com");

    const result = await resetPasswordAction({}, formData);

    expect(result.ok).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "https://english.example/auth/callback?next=/auth/update-password"
    });
  });

  it("updates the password for the recovery session and signs out", async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
    const updateUser = vi.fn(async () => ({ error: null }));
    const signOut = vi.fn(async () => ({ error: null }));
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser, updateUser, signOut }
    });

    const { updatePasswordAction } = await import("@/app/actions");
    const formData = new FormData();
    formData.set("password", "new-secret");
    formData.set("confirmPassword", "new-secret");

    const result = await updatePasswordAction({}, formData);

    expect(result).toEqual({ ok: true, message: "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요." });
    expect(updateUser).toHaveBeenCalledWith({ password: "new-secret" });
    expect(signOut).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects mismatched password confirmation before calling Supabase", async () => {
    const { updatePasswordAction } = await import("@/app/actions");
    const formData = new FormData();
    formData.set("password", "new-secret");
    formData.set("confirmPassword", "different-secret");

    const result = await updatePasswordAction({}, formData);

    expect(result).toEqual({ ok: false, message: "비밀번호 확인이 일치하지 않습니다." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
