import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ExpressionCard } from "@/lib/types";

vi.mock("@/app/actions", () => ({ recordExpressionReviewAction: vi.fn(async () => undefined) }));

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
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  examples: [{ id: "example-1", expression_id: "expression-1", example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm", sort_order: 0, created_at: "2026-04-28T00:00:00.000Z" }]
};

describe("MemorizeCard", () => {
  it("hides English before reveal and then shows known/unknown controls", async () => {
    const user = userEvent.setup();
    render(<MemorizeCard expression={expression} />);

    expect(screen.getByText((content) => content.includes(expression.korean_prompt))).toBeInTheDocument();
    expect(screen.queryByText(expression.english)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));

    expect(screen.getByText(expression.english)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /맞췄음/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /모름/ })).toBeInTheDocument();
  });
});
