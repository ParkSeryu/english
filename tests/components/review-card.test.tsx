import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpressionCard } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  recordExpressionReviewAction: vi.fn(async () => undefined),
  recordExpressionReviewInPlaceAction: vi.fn(async () => ({ ok: true }))
}));

import { recordExpressionReviewAction, recordExpressionReviewInPlaceAction } from "@/app/actions";
import { MemorizeCard } from "@/components/MemorizeCard";

const expression: ExpressionCard = {
  id: "expression-1",
  expression_day_id: "day-1",
  owner_id: "user-a",
  english: "have to ~",
  korean_prompt: "~해야 한다 / ~할 필요가 있다",
  nuance_note: "의무나 필요성을 일상적으로 표현한다.",
  structure_note: "have to + 동사원형",
  grammar_note: "3인칭 단수는 has to",
  user_memo: "선생님이 must보다 일상적이라고 함",
  source_order: 0,
  known_count: 0,
  unknown_count: 0,
  review_count: 0,
  last_result: null,
  last_reviewed_at: null,
  due_at: null,
  interval_days: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  examples: [{ id: "example-1", expression_id: "expression-1", example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm", sort_order: 0, created_at: "2026-04-28T00:00:00.000Z" }]
};

describe("MemorizeCard", () => {
  const redirectReviewAction = vi.mocked(recordExpressionReviewAction);
  const inPlaceReviewAction = vi.mocked(recordExpressionReviewInPlaceAction);

  beforeEach(() => {
    redirectReviewAction.mockClear();
    inPlaceReviewAction.mockClear();
  });

  it("hides English before reveal and then shows known/unknown controls", async () => {
    const user = userEvent.setup();
    render(<MemorizeCard expression={expression} />);

    expect(screen.getByRole("heading", { name: expression.korean_prompt })).toBeInTheDocument();
    expect(screen.queryByText(expression.english)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));

    expect(screen.queryByRole("button", { name: /정답 보기/ })).not.toBeInTheDocument();
    expect(screen.getByText(expression.english)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /외웠음/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /모름/ })).toBeInTheDocument();
  });

  it("uses the redirecting review action when it is not inside an optimistic queue", async () => {
    const user = userEvent.setup();
    render(<MemorizeCard expression={expression} returnTo="/review/confusing" />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));

    await waitFor(() => expect(redirectReviewAction).toHaveBeenCalledWith(expression.id, "unknown", "/review/confusing"));
    expect(inPlaceReviewAction).not.toHaveBeenCalled();
  });
});
