import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionState } from "@/lib/types";

let actionState: ActionState = { ok: false };

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: (action: unknown) => [actionState, action, false]
  };
});

vi.mock("@/app/actions", () => ({
  createPersonalExpressionAction: vi.fn()
}));

import { PersonalExpressionForm } from "@/components/PersonalExpressionForm";

describe("PersonalExpressionForm", () => {
  beforeEach(() => {
    actionState = { ok: false };
  });

  it("keeps entered expression fields when a save error is shown", () => {
    const { rerender } = render(<PersonalExpressionForm targetExpressionDayId="11111111-1111-4111-8111-111111111111" />);

    fireEvent.change(screen.getByLabelText("영어 표현"), { target: { value: "Coffee is not helping." } });
    fireEvent.change(screen.getByLabelText("한국어 뜻 / 암기 프롬프트"), { target: { value: "커피가 도움이 안 돼요." } });
    fireEvent.change(screen.getByLabelText("문법/패턴 메모"), { target: { value: "help = 도움이 되다" } });
    fireEvent.change(screen.getByLabelText("내 메모"), { target: { value: "수업 중 추가" } });
    fireEvent.click(screen.getByLabelText(/저장하면서 암기카드에 넣기/));

    actionState = { ok: false, message: "저장에 실패했습니다." };
    rerender(<PersonalExpressionForm targetExpressionDayId="11111111-1111-4111-8111-111111111111" />);

    expect(screen.getByLabelText("영어 표현")).toHaveValue("Coffee is not helping.");
    expect(screen.getByLabelText("한국어 뜻 / 암기 프롬프트")).toHaveValue("커피가 도움이 안 돼요.");
    expect(screen.getByLabelText("문법/패턴 메모")).toHaveValue("help = 도움이 되다");
    expect(screen.getByLabelText("내 메모")).toHaveValue("수업 중 추가");
    expect(screen.getByLabelText(/저장하면서 암기카드에 넣기/)).toBeChecked();
    expect(screen.getByText("저장에 실패했습니다.")).toBeInTheDocument();
  });
});
