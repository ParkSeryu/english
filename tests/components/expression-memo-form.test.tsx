import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExpressionCard } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  updateExpressionMemoAction: vi.fn()
}));

import { ExpressionMemoForm } from "@/components/ExpressionMemoForm";

function expression(overrides: Partial<ExpressionCard> = {}): ExpressionCard {
  return {
    id: "expression-1",
    expression_day_id: "day-1",
    owner_id: "owner-1",
    english: "I am used to -ing",
    korean_prompt: "-ing에 익숙하다",
    nuance_note: null,
    structure_note: null,
    grammar_note: null,
    user_memo: "내가 저장한 메모",
    source_order: 1,
    is_memorization_enabled: true,
    can_delete: false,
    known_count: 0,
    unknown_count: 0,
    review_count: 0,
    last_result: null,
    last_reviewed_at: null,
    due_at: null,
    interval_days: 0,
    created_at: "2026-05-05T00:00:00.000Z",
    updated_at: "2026-05-05T00:00:00.000Z",
    examples: [],
    ...overrides
  };
}

describe("ExpressionMemoForm", () => {
  it("hides the memorization checkbox when the detail page only edits memo", () => {
    const { container } = render(<ExpressionMemoForm expression={expression()} showMemorizationToggle={false} />);

    expect(screen.getByLabelText("내 메모")).toHaveValue("내가 저장한 메모");
    expect(screen.queryByRole("checkbox", { name: /암기카드에 넣기/ })).not.toBeInTheDocument();
    expect(container.querySelector('input[type="hidden"][name="isMemorizationEnabled"]')).toHaveValue("on");
  });

  it("can still render the memorization checkbox when explicitly requested", () => {
    render(<ExpressionMemoForm expression={expression()} />);

    expect(screen.getByRole("checkbox", { name: /암기카드에 넣기/ })).toBeChecked();
  });
});
