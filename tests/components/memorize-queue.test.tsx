import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpressionCard } from "@/lib/types";

vi.mock("@/app/actions", () => ({ recordExpressionReviewAction: vi.fn(async () => undefined) }));

import { recordExpressionReviewAction } from "@/app/actions";
import { MemorizeQueue } from "@/components/MemorizeQueue";

function expression(overrides: Partial<ExpressionCard>): ExpressionCard {
  return {
    id: "expression-1",
    expression_day_id: "day-1",
    owner_id: "user-a",
    english: "They don't seem to care about me.",
    korean_prompt: "그들은 저를 신경 쓰지 않는 것 같아요.",
    nuance_note: null,
    structure_note: null,
    grammar_note: null,
    user_memo: null,
    source_order: 0,
    unknown_count: 0,
    known_count: 0,
    review_count: 0,
    last_result: null,
    last_reviewed_at: null,
    due_at: null,
    interval_days: 0,
    created_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    examples: [],
    ...overrides
  };
}

const first = expression({ id: "expression-1", korean_prompt: "첫 번째 한국어", english: "First answer" });
const second = expression({ id: "expression-2", korean_prompt: "두 번째 한국어", english: "Second answer", source_order: 1 });
const third = expression({ id: "expression-3", korean_prompt: "세 번째 한국어", english: "Third answer", source_order: 2 });

describe("MemorizeQueue", () => {
  const reviewAction = vi.mocked(recordExpressionReviewAction);

  beforeEach(() => {
    reviewAction.mockClear();
  });

  it("optimistically advances to the next expression as soon as a review button is submitted", async () => {
    const user = userEvent.setup();
    render(<MemorizeQueue expressions={[first, second]} />);

    expect(screen.getByText("첫 번째 한국어")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));

    expect(screen.queryByText("First answer")).not.toBeInTheDocument();
    expect(screen.queryByText("첫 번째 한국어")).not.toBeInTheDocument();
    expect(screen.getByText("두 번째 한국어")).toBeInTheDocument();
  });

  it("keeps locally deferred unknown cards stacked while reviewing before a server refresh lands", async () => {
    const user = userEvent.setup();
    render(<MemorizeQueue expressions={[first, second, third]} />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));
    await waitFor(() => expect(reviewAction).toHaveBeenCalledTimes(1));

    expect(reviewAction).toHaveBeenNthCalledWith(1, first.id, "unknown", "/memorize?defer=expression-1", expect.any(FormData));
    expect(screen.getByText("두 번째 한국어")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));
    await waitFor(() => expect(reviewAction).toHaveBeenCalledTimes(2));

    expect(reviewAction).toHaveBeenNthCalledWith(2, second.id, "unknown", "/memorize?defer=expression-1%2Cexpression-2", expect.any(FormData));
    expect(screen.getByText("세 번째 한국어")).toBeInTheDocument();
  });

  it("uses the first expression from a refreshed deferred queue instead of carrying over the old active index", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MemorizeQueue expressions={[first, second, third]} />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));

    rerender(<MemorizeQueue expressions={[second, third, first]} deferredIds={[first.id]} />);

    expect(screen.getByText("두 번째 한국어")).toBeInTheDocument();
    expect(screen.queryByText("세 번째 한국어")).not.toBeInTheDocument();
  });
});
