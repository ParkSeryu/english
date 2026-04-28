import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StudyCard } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  markKnownAction: vi.fn(async () => undefined),
  markConfusingAction: vi.fn(async () => undefined),
  markKnownFromConfusingAction: vi.fn(async () => undefined)
}));

import { ReviewCard } from "@/components/ReviewCard";

const card: StudyCard = {
  id: "card-1",
  owner_id: "user-a",
  english_text: "Could you elaborate on that?",
  korean_meaning: "그 부분을 좀 더 자세히 설명해 주실 수 있나요?",
  grammar_note: "Polite clarification request.",
  status: "new",
  last_reviewed_at: null,
  review_count: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  examples: [
    {
      id: "example-1",
      card_id: "card-1",
      example_text: "Could you elaborate on your plan?",
      sort_order: 0,
      created_at: "2026-04-28T00:00:00.000Z"
    }
  ]
};

describe("ReviewCard", () => {
  it("hides review details before reveal and then shows mark controls", async () => {
    const user = userEvent.setup();
    render(<ReviewCard card={card} />);

    expect(screen.getByText(card.english_text)).toBeInTheDocument();
    expect(screen.queryByText(card.korean_meaning)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));

    expect(screen.getByText(card.korean_meaning)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /알고 있었어요/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /아직 헷갈려요/ })).toBeInTheDocument();
  });
});
