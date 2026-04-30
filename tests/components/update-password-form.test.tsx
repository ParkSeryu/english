import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const actionState = { ok: false, message: "" };

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: (action: unknown) => [actionState, action, false]
  };
});

vi.mock("@/app/actions", () => ({
  updatePasswordAction: vi.fn()
}));

import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

describe("UpdatePasswordForm", () => {
  it("asks for and confirms the new password after a reset link opens", () => {
    render(<UpdatePasswordForm />);

    expect(screen.getByRole("form", { name: "새 비밀번호 설정" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "새 비밀번호 설정" })).toBeInTheDocument();
    expect(screen.getByLabelText("새 비밀번호")).toBeInTheDocument();
    expect(screen.getByLabelText("새 비밀번호 확인")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비밀번호 변경" })).toBeInTheDocument();
  });
});
