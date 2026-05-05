import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  deletePersonalExpressionAction: vi.fn()
}));

import { DeletePersonalExpressionForm } from "@/components/DeletePersonalExpressionForm";

describe("DeletePersonalExpressionForm", () => {
  it("asks for confirmation before rendering the destructive submit", () => {
    render(<DeletePersonalExpressionForm expressionId="expression-1" />);

    expect(screen.getByRole("button", { name: "삭제" })).toHaveAttribute("type", "button");
    expect(screen.queryByText("진짜 삭제할까요?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(screen.getByText("진짜 삭제할까요?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toHaveAttribute("type", "submit");
  });
});
