import { fireEvent, render, screen } from "@testing-library/react";
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
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
  resetPasswordAction: vi.fn()
}));

import { AuthPanel } from "@/components/AuthPanel";

describe("AuthPanel", () => {
  it("starts with only the login form and exposes small account-help links", () => {
    render(<AuthPanel />);

    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "회원가입" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "회원가입" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "아이디·비밀번호 찾기" })).toBeInTheDocument();
  });

  it("moves signup behind the small signup link instead of showing two forms at once", () => {
    render(<AuthPanel />);

    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("shows email-as-id guidance and password reset form from account help", () => {
    render(<AuthPanel />);

    fireEvent.click(screen.getByRole("button", { name: "아이디·비밀번호 찾기" }));

    expect(screen.getByRole("heading", { name: "아이디·비밀번호 찾기" })).toBeInTheDocument();
    expect(screen.getByText(/이 앱은 이메일을 아이디로 사용해요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비밀번호 재설정 메일 받기" })).toBeInTheDocument();
  });
});
