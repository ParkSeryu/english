import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  recordExpressionReviewAction: vi.fn(async () => undefined)
}));

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type ExpressionCardForTest = {
  id: string;
  expression_day_id: string;
  owner_id: string;
  english: string;
  korean_prompt: string;
  nuance_note: string | null;
  structure_note: string | null;
  grammar_note: string | null;
  user_memo: string | null;
  source_order: number;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_result: "known" | "unknown" | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  examples: Array<{
    id: string;
    expression_id: string;
    example_text: string;
    meaning_ko: string | null;
    source: "llm" | "user" | "class";
    sort_order: number;
    created_at: string;
  }>;
};

type MemorizeCardModule = {
  MemorizeCard: ComponentType<{ expression: ExpressionCardForTest; returnTo?: string }>;
};

const expression: ExpressionCardForTest = {
  id: "expression-1",
  expression_day_id: "day-1",
  owner_id: "user-a",
  english: "They don't seem to care about me.",
  korean_prompt: "그들은 저를 신경 쓰지 않는 것 같아요.",
  nuance_note: "원문 문장을 암기 답으로 유지한다.",
  structure_note: "seem to + 동사원형",
  grammar_note: "don't seem to + 동사원형 = ~하는 것 같지 않다",
  user_memo: null,
  source_order: 0,
  unknown_count: 2,
  known_count: 1,
  review_count: 3,
  last_result: "unknown",
  last_reviewed_at: "2026-04-28T00:00:00.000Z",
  created_at: "2026-04-27T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  examples: [{ id: "example-1", expression_id: "expression-1", example_text: "They don't seem interested in me.", meaning_ko: "그들은 나에게 관심이 없어 보여요.", source: "llm", sort_order: 0, created_at: "2026-04-28T00:00:00.000Z" }]
};

describe("MemorizeCard", () => {
  it("shows Korean first, hides English until reveal, then exposes simple known/unknown controls", async () => {
    const user = userEvent.setup();
    const { MemorizeCard } = await importModule<MemorizeCardModule>("@/components/MemorizeCard");
    render(<MemorizeCard expression={expression} />);

    expect(screen.getByText(expression.korean_prompt)).toBeInTheDocument();
    expect(screen.queryByText(expression.english)).not.toBeInTheDocument();
    expect(screen.queryByText(expression.grammar_note ?? "")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));

    expect(screen.getByText(expression.english)).toBeInTheDocument();
    expect(screen.getByText("비슷한 표현")).toBeInTheDocument();
    expect(screen.getByText("They don't seem interested in me.")).toBeInTheDocument();
    expect(screen.getByText(expression.grammar_note ?? "")).toBeInTheDocument();
    expect(screen.queryByText("느낌 / 뉘앙스")).not.toBeInTheDocument();
    expect(screen.queryByText("구조")).not.toBeInTheDocument();
    expect(screen.queryByText(expression.nuance_note ?? "")).not.toBeInTheDocument();
    expect(screen.queryByText(expression.structure_note ?? "")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /맞췄음/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /모름/ })).toBeInTheDocument();
  });

  it("hides the answer again after marking an expression unknown", async () => {
    const user = userEvent.setup();
    const { MemorizeCard } = await importModule<MemorizeCardModule>("@/components/MemorizeCard");
    render(<MemorizeCard expression={expression} />);

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));
    expect(screen.getByText(expression.english)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /모름/ }));

    expect(screen.queryByText(expression.english)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /정답 보기/ })).toBeInTheDocument();
  });
});
