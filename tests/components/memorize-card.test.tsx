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
  day_id: string;
  owner_id: string;
  english_text: string;
  korean_text: string;
  grammar_point: string | null;
  natural_note: string | null;
  source_order: number;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_result: "known" | "unknown" | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MemorizeCardModule = {
  MemorizeCard: ComponentType<{ expression: ExpressionCardForTest; returnTo?: string }>;
};

const expression: ExpressionCardForTest = {
  id: "expression-1",
  day_id: "day-1",
  owner_id: "user-a",
  english_text: "They don't seem to care about me.",
  korean_text: "그들은 저를 신경 쓰지 않는 것 같아요.",
  grammar_point: "don't seem to + 동사원형 = ~하는 것 같지 않다",
  natural_note: "원문 문장을 암기 답으로 유지한다.",
  source_order: 0,
  unknown_count: 2,
  known_count: 1,
  review_count: 3,
  last_result: "unknown",
  last_reviewed_at: "2026-04-28T00:00:00.000Z",
  created_at: "2026-04-27T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z"
};

describe("MemorizeCard", () => {
  it("shows Korean first, hides English until reveal, then exposes simple known/unknown controls", async () => {
    const user = userEvent.setup();
    const { MemorizeCard } = await importModule<MemorizeCardModule>("@/components/MemorizeCard");
    render(<MemorizeCard expression={expression} />);

    expect(screen.getByText(expression.korean_text)).toBeInTheDocument();
    expect(screen.queryByText(expression.english_text)).not.toBeInTheDocument();
    expect(screen.queryByText(expression.grammar_point ?? "")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /영어 보기/ }));

    expect(screen.getByText(expression.english_text)).toBeInTheDocument();
    expect(screen.getByText(expression.grammar_point ?? "")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /맞췄음/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /모름/ })).toBeInTheDocument();
  });
});
