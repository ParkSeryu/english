import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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
    window.sessionStorage.clear();
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

  it("updates the remaining count optimistically only after remembered reviews", async () => {
    const user = userEvent.setup();
    render(<MemorizeQueue expressions={[first, second, third]} />);

    expect(screen.getByText("복습할 표현 3개")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));

    expect(screen.getByText("복습할 표현 3개")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /외웠음/ }));

    expect(screen.getByText("복습할 표현 2개")).toBeInTheDocument();
  });

  it("shows the empty memorization state immediately after the last card is remembered", async () => {
    const user = userEvent.setup();
    render(<MemorizeQueue expressions={[first, second]} />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /외웠음/ }));
    expect(screen.getByText("두 번째 한국어")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /외웠음/ }));

    expect(screen.getByText("복습할 표현 0개")).toBeInTheDocument();
    expect(screen.getByText("암기할 표현이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("배운 표현이 생기면 한국어 힌트로 바로 복습할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "표현 모아보기" })).toHaveAttribute("href", "/expressions");
    expect(screen.queryByRole("button", { name: /정답 보기/ })).not.toBeInTheDocument();
  });

  it("server-renders a preparation state before browser storage can restore the queue", () => {
    const html = renderToString(<MemorizeQueue expressions={[first, second, third]} />);

    expect(html).toContain("복습 준비 중…");
    expect(html).not.toContain("첫 번째 한국어");
  });

  it("restores the stored queue position after mounting", async () => {
    window.sessionStorage.setItem(
      "english:memorize-session:v1",
      JSON.stringify({
        queueIds: [second.id, third.id, first.id],
        activeId: second.id,
        deferredIds: [first.id]
      })
    );

    render(<MemorizeQueue expressions={[first, second, third]} />);

    await waitFor(() => expect(screen.getByText("두 번째 한국어")).toBeInTheDocument());
    expect(screen.queryByText("첫 번째 한국어")).not.toBeInTheDocument();
    expect(screen.queryByText("복습 준비 중…")).not.toBeInTheDocument();
  });

  it("restores the current queue position from sessionStorage after remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MemorizeQueue expressions={[first, second, third]} />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    await user.click(screen.getByRole("button", { name: /모름/ }));
    await waitFor(() => expect(window.sessionStorage.getItem("english:memorize-session:v1")).toContain(second.id));

    unmount();
    render(<MemorizeQueue expressions={[first, second, third]} />);

    await waitFor(() => expect(screen.getByText("두 번째 한국어")).toBeInTheDocument());
    expect(screen.queryByText("첫 번째 한국어")).not.toBeInTheDocument();
  });

  it("drops stale stored cards that are no longer in the server queue", async () => {
    window.sessionStorage.setItem(
      "english:memorize-session:v1",
      JSON.stringify({
        queueIds: [second.id, third.id, first.id],
        activeId: second.id,
        deferredIds: [first.id]
      })
    );

    render(<MemorizeQueue expressions={[third, first]} deferredIds={[first.id]} />);

    await waitFor(() => expect(screen.getByText("세 번째 한국어")).toBeInTheDocument());
    expect(screen.queryByText("두 번째 한국어")).not.toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem("english:memorize-session:v1")).not.toContain(second.id));
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
